import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { localDataSource } from "./local";

// IST = UTC+5:30. 08:00 UTC keeps the same calendar day in both UTC and IST, so these times are
// safe "midday IST" stand-ins for each date, with no midnight-boundary risk.
function setIstDay(date: string) {
  vi.setSystemTime(new Date(`${date}T08:00:00.000Z`));
}

function mockContentFetch(payloadByDate: Record<string, { payload: unknown; reserve?: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const match = url.match(/\/__content\/([\w-]+)\/(\d{4}-\d{2}-\d{2})\.json/);
      const date = match?.[2];
      const content = date ? payloadByDate[date] : undefined;
      if (!content) return new Response("null", { status: 404 });
      return new Response(JSON.stringify(content), { status: 200 });
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getPuzzle", () => {
  it("returns today's puzzle, and never a future one", async () => {
    setIstDay("2026-10-10");
    mockContentFetch({
      "2026-10-10": { payload: { answer: "CRANE" }, reserve: null },
      "2026-10-11": { payload: { answer: "SPOIL" } },
    });

    expect(await localDataSource.getPuzzle("demo", "2026-10-10")).toEqual({
      main: { answer: "CRANE" },
      reserve: undefined,
    });
    expect(await localDataSource.getPuzzle("demo", "2026-10-11")).toBeNull();
  });

  it("returns null when there's no content for that day", async () => {
    setIstDay("2026-10-10");
    mockContentFetch({});
    expect(await localDataSource.getPuzzle("demo", "2026-10-10")).toBeNull();
  });
});

describe("startPlay / getPlay", () => {
  it("cannot start tomorrow's puzzle", async () => {
    setIstDay("2026-10-10");
    await expect(localDataSource.startPlay("demo", "2026-10-11")).rejects.toThrow();
  });

  it("starts a play and can read it back", async () => {
    setIstDay("2026-10-10");
    const play = await localDataSource.startPlay("demo", "2026-10-10");
    expect(play.status).toBe("in_progress");
    expect(play.variant).toBe("main");
    expect(await localDataSource.getPlay("demo", "2026-10-10")).toMatchObject({
      gameId: "demo",
      status: "in_progress",
    });
  });

  it("cannot start the same puzzle twice", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await expect(localDataSource.startPlay("demo", "2026-10-10")).rejects.toThrow();
  });

  it("getPlay returns null when nothing was started", async () => {
    setIstDay("2026-10-10");
    expect(await localDataSource.getPlay("demo", "2026-10-10")).toBeNull();
  });
});

describe("savePlay", () => {
  it("can switch variant before any state is saved", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.savePlay("demo", "2026-10-10", { variant: "reserve" });
    expect(await localDataSource.getPlay("demo", "2026-10-10")).toMatchObject({
      variant: "reserve",
    });
  });

  it("cannot switch variant once state has been saved", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.savePlay("demo", "2026-10-10", { state: { guesses: ["CRANE"] } });
    await expect(
      localDataSource.savePlay("demo", "2026-10-10", { variant: "reserve" }),
    ).rejects.toThrow();
  });

  it("cannot save without starting first", async () => {
    setIstDay("2026-10-10");
    await expect(
      localDataSource.savePlay("demo", "2026-10-10", { state: { x: 1 } }),
    ).rejects.toThrow();
  });
});

describe("finishPlay", () => {
  it("locks the play: no further save or finish", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.finishPlay("demo", "2026-10-10", {
      won: true,
      state: { guesses: ["CRANE"] },
      summary: "🟩🟩🟩🟩🟩",
      score: 1,
    });

    const play = await localDataSource.getPlay("demo", "2026-10-10");
    expect(play).toMatchObject({ status: "won", summary: "🟩🟩🟩🟩🟩", score: 1 });

    await expect(
      localDataSource.savePlay("demo", "2026-10-10", { state: { guesses: [] } }),
    ).rejects.toThrow();
    await expect(
      localDataSource.finishPlay("demo", "2026-10-10", {
        won: false,
        state: {},
        summary: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("getStats — streaks", () => {
  it("counts consecutive on-day wins as a streak, and archive catch-ups as played but not streak-extending", async () => {
    for (const date of ["2026-10-08", "2026-10-09", "2026-10-10"]) {
      setIstDay(date);
      await localDataSource.startPlay("demo", date);
      await localDataSource.finishPlay("demo", date, { won: true, state: {}, summary: "win" });
    }

    // Catch up on a day missed before the streak started — played late, after the puzzle's date.
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-01");
    await localDataSource.finishPlay("demo", "2026-10-01", { won: true, state: {}, summary: "win" });

    const stats = await localDataSource.getStats();
    expect(stats.demo.played).toBe(4);
    expect(stats.demo.won).toBe(4);
    expect(stats.demo.currentStreak).toBe(3);
    expect(stats.demo.maxStreak).toBe(3);
  });

  it("a loss today resets the current streak but keeps the max", async () => {
    setIstDay("2026-10-09");
    await localDataSource.startPlay("demo", "2026-10-09");
    await localDataSource.finishPlay("demo", "2026-10-09", { won: true, state: {}, summary: "w" });

    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.finishPlay("demo", "2026-10-10", { won: false, state: {}, summary: "l" });

    const stats = await localDataSource.getStats();
    expect(stats.demo.currentStreak).toBe(0);
    expect(stats.demo.maxStreak).toBe(1);
  });

  it("not having played today yet still counts yesterday's streak", async () => {
    setIstDay("2026-10-09");
    await localDataSource.startPlay("demo", "2026-10-09");
    await localDataSource.finishPlay("demo", "2026-10-09", { won: true, state: {}, summary: "w" });

    setIstDay("2026-10-10");
    const stats = await localDataSource.getStats();
    expect(stats.demo.currentStreak).toBe(1);
  });
});

describe("getFriendsResults", () => {
  it("is empty until I have finished", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    expect(await localDataSource.getFriendsResults("demo", "2026-10-10")).toEqual([]);
  });

  it("shows friends once I've finished", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.finishPlay("demo", "2026-10-10", { won: true, state: {}, summary: "w" });
    const friends = await localDataSource.getFriendsResults("demo", "2026-10-10");
    expect(friends.length).toBe(2);
    for (const f of friends) {
      expect(["won", "lost"]).toContain(f.status);
    }
  });
});

describe("listPlays", () => {
  it("is empty when nothing has been played", async () => {
    setIstDay("2026-10-10");
    expect(await localDataSource.listPlays("demo")).toEqual([]);
  });

  it("lists every play for the game, sorted by date, including in-progress ones", async () => {
    setIstDay("2026-10-08");
    await localDataSource.startPlay("demo", "2026-10-08");
    await localDataSource.finishPlay("demo", "2026-10-08", {
      won: true,
      state: {},
      summary: "w",
      score: 4,
    });

    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.finishPlay("demo", "2026-10-10", { won: false, state: {}, summary: "l" });

    await localDataSource.startPlay("demo", "2026-10-09");

    expect(await localDataSource.listPlays("demo")).toEqual([
      { date: "2026-10-08", status: "won", score: 4 },
      { date: "2026-10-09", status: "in_progress", score: undefined },
      { date: "2026-10-10", status: "lost", score: undefined },
    ]);
  });

  it("only lists plays for the requested game", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.startPlay("other", "2026-10-10");

    const demoPlays = await localDataSource.listPlays("demo");
    expect(demoPlays.map((p) => p.date)).toEqual(["2026-10-10"]);
  });
});
