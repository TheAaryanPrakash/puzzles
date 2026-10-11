import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { friendlyError } from "./supabase";

// createClient is mocked so these tests never touch a real Supabase project — only the request
// shaping and error mapping in supabase.ts, against a hand-rolled fake PostgREST/RPC client.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/** A chainable fake that ignores which filter methods were called and just resolves `result` —
 *  good enough here because these tests exercise supabase.ts's own mapping logic, not RLS. */
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    insert: () => builder,
    update: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (onFulfilled: (r: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

/** Each `.from(...)` call pops the next queued result, in call order. */
function makeClient(fromResults: QueryResult[], rpcResult?: QueryResult) {
  const queue = [...fromResults];
  return {
    from: vi.fn(() => {
      const next = queue.shift();
      if (!next) throw new Error("test bug: more .from() calls than queued results");
      return makeBuilder(next);
    }),
    rpc: vi.fn(() => Promise.resolve(rpcResult ?? { data: null, error: null })),
  };
}

async function withClient(fromResults: QueryResult[], rpcResult?: QueryResult) {
  createClient.mockReturnValue(makeClient(fromResults, rpcResult));
  const mod = await import("./supabase");
  return mod.supabaseDataSource;
}

beforeEach(() => {
  vi.resetModules();
  createClient.mockReset();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("friendlyError", () => {
  it("maps a duplicate play to 'already played'", () => {
    expect(friendlyError({ message: "duplicate key value violates unique constraint" }).message).toBe(
      "You've already played this one.",
    );
    expect(friendlyError({ message: "x", code: "23505" }).message).toBe(
      "You've already played this one.",
    );
  });

  it("maps an RLS violation to 'not available yet'", () => {
    expect(
      friendlyError({ message: 'new row violates row-level security policy for table "plays"' })
        .message,
    ).toBe("This puzzle isn't available yet.");
  });

  it("maps a bad invite code", () => {
    expect(friendlyError({ message: "invalid invite code" }).message).toBe(
      "That invite code isn't right.",
    );
  });

  it("maps a display name constraint violation", () => {
    expect(
      friendlyError({ message: 'new row violates check constraint "profiles_display_name_check"' })
        .message,
    ).toBe("Name must be between 1 and 30 characters.");
  });

  it("falls back to a generic message for anything else", () => {
    expect(friendlyError({ message: "connection reset" }).message).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("getPuzzle", () => {
  it("returns main and reserve, treating a null reserve as undefined", async () => {
    const ds = await withClient([
      { data: { payload: { answer: "CRANE" }, reserve: null }, error: null },
    ]);
    expect(await ds.getPuzzle("wordle", "2026-10-10")).toEqual({
      main: { answer: "CRANE" },
      reserve: undefined,
    });
  });

  it("returns null when the row is missing or hidden by RLS", async () => {
    const ds = await withClient([{ data: null, error: null }]);
    expect(await ds.getPuzzle("wordle", "2026-10-20")).toBeNull();
  });
});

describe("getPlay", () => {
  it("returns null when there's no play yet", async () => {
    const ds = await withClient([{ data: null, error: null }]);
    expect(await ds.getPlay("wordle", "2026-10-10")).toBeNull();
  });

  it("maps a row, turning null summary/score into undefined", async () => {
    const ds = await withClient([
      {
        data: {
          user_id: "u1",
          game_id: "wordle",
          puzzle_date: "2026-10-10",
          variant: "main",
          status: "in_progress",
          state: { guesses: ["CRANE"] },
          summary: null,
          score: null,
          started_at: "2026-10-10T09:00:00Z",
          completed_at: null,
        },
        error: null,
      },
    ]);
    expect(await ds.getPlay("wordle", "2026-10-10")).toEqual({
      gameId: "wordle",
      date: "2026-10-10",
      variant: "main",
      status: "in_progress",
      state: { guesses: ["CRANE"] },
      summary: undefined,
      score: undefined,
    });
  });
});

describe("startPlay", () => {
  it("returns the created play", async () => {
    const ds = await withClient([
      {
        data: {
          user_id: "u1",
          game_id: "wordle",
          puzzle_date: "2026-10-10",
          variant: "main",
          status: "in_progress",
          state: {},
          summary: null,
          score: null,
          started_at: "2026-10-10T09:00:00Z",
          completed_at: null,
        },
        error: null,
      },
    ]);
    const play = await ds.startPlay("wordle", "2026-10-10");
    expect(play.status).toBe("in_progress");
    expect(play.gameId).toBe("wordle");
  });

  it("turns a duplicate insert into a friendly error", async () => {
    const ds = await withClient([
      { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } },
    ]);
    await expect(ds.startPlay("wordle", "2026-10-10")).rejects.toThrow(
      "You've already played this one.",
    );
  });

  it("turns a release-gating RLS failure into a friendly error", async () => {
    const ds = await withClient([
      { data: null, error: { message: 'new row violates row-level security policy for table "plays"' } },
    ]);
    await expect(ds.startPlay("wordle", "2026-10-20")).rejects.toThrow(
      "This puzzle isn't available yet.",
    );
  });
});

describe("savePlay", () => {
  it("resolves when the update affects a row", async () => {
    const ds = await withClient([{ data: [{ game_id: "wordle" }], error: null }]);
    await expect(ds.savePlay("wordle", "2026-10-10", { state: { guesses: ["CRANE"] } })).resolves.toBeUndefined();
  });

  it("explains a 0-row update as 'already played' when the play is finished", async () => {
    // First call: the update itself (0 rows — excluded by the finished-play RLS check).
    // Second call: savePlay's own existence/status lookup.
    const ds = await withClient([
      { data: [], error: null },
      { data: { status: "won" }, error: null },
    ]);
    await expect(ds.savePlay("wordle", "2026-10-10", { state: {} })).rejects.toThrow(
      "You've already played this one.",
    );
  });

  it("explains a 0-row update as 'never started' when there's no play at all", async () => {
    const ds = await withClient([
      { data: [], error: null },
      { data: null, error: null },
    ]);
    await expect(ds.savePlay("wordle", "2026-10-10", { state: {} })).rejects.toThrow(
      "No play to save — start the puzzle first.",
    );
  });
});

describe("finishPlay", () => {
  it("resolves when the update affects a row", async () => {
    const ds = await withClient([{ data: [{ game_id: "wordle" }], error: null }]);
    await expect(
      ds.finishPlay("wordle", "2026-10-10", { won: true, state: {}, summary: "🟩🟩🟩🟩🟩", score: 3 }),
    ).resolves.toBeUndefined();
  });

  it("explains a 0-row update as 'already played'", async () => {
    const ds = await withClient([
      { data: [], error: null },
      { data: { status: "lost" }, error: null },
    ]);
    await expect(
      ds.finishPlay("wordle", "2026-10-10", { won: false, state: {}, summary: "⬛⬛⬛⬛⬛" }),
    ).rejects.toThrow("You've already played this one.");
  });
});

describe("getStats", () => {
  it("maps RPC rows into a camelCase record keyed by game id", async () => {
    const ds = await withClient([], {
      data: [
        { game_id: "wordle", played: 5, won: 4, current_streak: 2, max_streak: 3 },
        { game_id: "bee", played: 1, won: 0, current_streak: 0, max_streak: 0 },
      ],
      error: null,
    });
    expect(await ds.getStats()).toEqual({
      wordle: { played: 5, won: 4, currentStreak: 2, maxStreak: 3 },
      bee: { played: 1, won: 0, currentStreak: 0, maxStreak: 0 },
    });
  });

  it("returns an empty record when there's no history yet", async () => {
    const ds = await withClient([], { data: [], error: null });
    expect(await ds.getStats()).toEqual({});
  });
});

describe("getFriendsResults", () => {
  it("maps display_name to name and defaults a null summary to empty string", async () => {
    const ds = await withClient([], {
      data: [
        { display_name: "Amal", status: "won", summary: "🟩🟩🟩🟩🟩", score: 3, completed_at: "x" },
        { display_name: "Riya", status: "lost", summary: null, score: null, completed_at: "y" },
      ],
      error: null,
    });
    expect(await ds.getFriendsResults("wordle", "2026-10-10")).toEqual([
      { name: "Amal", status: "won", summary: "🟩🟩🟩🟩🟩", score: 3 },
      { name: "Riya", status: "lost", summary: "", score: undefined },
    ]);
  });
});

describe("listPlays", () => {
  it("maps rows and turns a null score into undefined", async () => {
    const ds = await withClient([
      {
        data: [
          { puzzle_date: "2026-10-09", status: "won", score: 3 },
          { puzzle_date: "2026-10-10", status: "lost", score: null },
        ],
        error: null,
      },
    ]);
    expect(await ds.listPlays("wordle")).toEqual([
      { date: "2026-10-09", status: "won", score: 3 },
      { date: "2026-10-10", status: "lost", score: undefined },
    ]);
  });
});
