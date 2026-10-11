import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AuthState } from "./auth";

// Mirrors src/lib/data/supabase.test.ts's approach: mock the supabase-js client so these tests
// exercise AuthProvider's own state transitions, never a real Supabase project.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/** A chainable fake that ignores which filter methods were called and just resolves `result`. */
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    update: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (onFulfilled: (r: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

/** Each `.from(...)` call pops the next queued result, in call order. */
function makeClient(
  fromResults: QueryResult[],
  opts: { session: { user: { id: string } } | null; rpcError?: { message: string } | null },
) {
  const queue = [...fromResults];
  return {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: opts.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
    },
    from: vi.fn(() => {
      const next = queue.shift();
      if (!next) throw new Error("test bug: more .from() calls than queued results");
      return makeBuilder(next);
    }),
    rpc: vi.fn(() => Promise.resolve({ error: opts.rpcError ?? null })),
  };
}

let container: HTMLDivElement;
let root: Root;
let latest: AuthState;

async function renderAuth(
  fromResults: QueryResult[],
  opts: { session: { user: { id: string } } | null; rpcError?: { message: string } | null },
) {
  createClient.mockReturnValue(makeClient(fromResults, opts));
  // Imported dynamically (after resetModules + stubEnv) so AuthProvider and useAuth below come
  // from the same fresh module instance that read VITE_DATA_SOURCE for this test.
  const authModule = await import("./auth");
  function Probe() {
    latest = authModule.useAuth();
    return null;
  }
  await act(async () => {
    root = createRoot(container);
    root.render(
      <authModule.AuthProvider>
        <Probe />
      </authModule.AuthProvider>,
    );
    await flush();
  });
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.resetModules();
  createClient.mockReset();
  vi.stubEnv("VITE_DATA_SOURCE", "supabase");
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllEnvs();
});

describe("joinWithInvite", () => {
  it("refreshes the member profile from the database and becomes a member", async () => {
    const session = { user: { id: "u1" } };
    // Call 1: the initial profile load on mount — not a member yet.
    // Call 2: fetchProfile's re-read after join_with_invite succeeds.
    await renderAuth(
      [
        { data: null, error: null },
        { data: { user_id: "u1", display_name: "Sansita" }, error: null },
      ],
      { session },
    );
    expect(latest.status).toBe("signed-in-not-member");

    await act(async () => {
      await latest.joinWithInvite("sunflower-23", "Sansita");
      await flush();
    });

    expect(latest.status).toBe("member");
    expect(latest.member).toEqual({ userId: "u1", displayName: "Sansita" });
  });

  it("does not become a member when the invite RPC fails", async () => {
    const session = { user: { id: "u1" } };
    await renderAuth([{ data: null, error: null }], {
      session,
      rpcError: { message: "invalid invite code" },
    });
    expect(latest.status).toBe("signed-in-not-member");

    await expect(
      act(async () => {
        await latest.joinWithInvite("wrong-code", "Sansita");
      }),
    ).rejects.toThrow("That invite code isn't right.");

    expect(latest.status).toBe("signed-in-not-member");
    expect(latest.member).toBeNull();
  });
});

describe("updateDisplayName", () => {
  it("reflects the name the database actually saved, not just the input", async () => {
    const session = { user: { id: "u1" } };
    // Call 1: initial profile load — already a member.
    // Call 2: the update itself.
    // Call 3: fetchProfile's re-read, returning the server's canonical (trimmed) value.
    await renderAuth(
      [
        { data: { user_id: "u1", display_name: "Sansita" }, error: null },
        { data: null, error: null },
        { data: { user_id: "u1", display_name: "Sansita B" }, error: null },
      ],
      { session },
    );
    expect(latest.member?.displayName).toBe("Sansita");

    await act(async () => {
      await latest.updateDisplayName("Sansita B");
      await flush();
    });

    expect(latest.member?.displayName).toBe("Sansita B");
  });

  it("leaves the member name unchanged when the update silently matches no row", async () => {
    const session = { user: { id: "u1" } };
    // The .update().eq() call can report no error while matching zero rows (wrong id, RLS) —
    // the re-read must then show the name is unchanged, not the attempted new name.
    await renderAuth(
      [
        { data: { user_id: "u1", display_name: "Sansita" }, error: null },
        { data: null, error: null },
        { data: { user_id: "u1", display_name: "Sansita" }, error: null },
      ],
      { session },
    );

    await act(async () => {
      await latest.updateDisplayName("Someone Else");
      await flush();
    });

    expect(latest.member?.displayName).toBe("Sansita");
  });
});
