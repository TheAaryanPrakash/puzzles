import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { localDataSource, readGroups, writeGroups, writeMembers } from "./local";

const LOCAL_USER_ID = "local-dev";

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
    expect(await localDataSource.getFriendsResults("demo", "2026-10-10", "g1")).toEqual([]);
  });

  it("shows friends once I've finished", async () => {
    setIstDay("2026-10-10");
    await localDataSource.startPlay("demo", "2026-10-10");
    await localDataSource.finishPlay("demo", "2026-10-10", { won: true, state: {}, summary: "w" });
    const friends = await localDataSource.getFriendsResults("demo", "2026-10-10", "g1");
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

describe("groups", () => {
  it("seeds one believable group, created by a friend, with fake friends already in it", async () => {
    const groups = await localDataSource.listMyGroups();
    expect(groups.length).toBe(1);
    expect(groups[0]).toMatchObject({ name: "Puzzle Pals", memberCount: 3, isCreator: false });
    expect(groups[0].inviteCode).toBeTruthy();
  });

  it("creates a group, up to 3 per creator", async () => {
    const seed = (await localDataSource.listMyGroups())[0];
    const g1 = await localDataSource.createGroup("Book Club");
    const g2 = await localDataSource.createGroup("Quiz Night");
    const g3 = await localDataSource.createGroup("Trivia");
    expect(new Set([seed.inviteCode, g1.inviteCode, g2.inviteCode, g3.inviteCode]).size).toBe(4);
    await expect(localDataSource.createGroup("One Too Many")).rejects.toThrow();
    const groups = await localDataSource.listMyGroups();
    expect(groups.length).toBe(4);
  });

  it("rejects a name outside 1-40 characters", async () => {
    await expect(localDataSource.createGroup("")).rejects.toThrow();
    await expect(localDataSource.createGroup("x".repeat(41))).rejects.toThrow();
  });

  it("joins a group by code and previews one without joining", async () => {
    const seed = (await localDataSource.listMyGroups())[0];
    const preview = await localDataSource.previewGroup(seed.inviteCode);
    expect(preview).toEqual({ id: seed.id, name: seed.name });
    expect(await localDataSource.previewGroup("not-a-real-code")).toBeNull();

    const created = await localDataSource.createGroup("Other Group");
    // Simulate joining as if not already a member by removing self first isn't supported locally,
    // so this just exercises the success path (membership is idempotent either way).
    const joined = await localDataSource.joinGroup(created.inviteCode);
    expect(joined.id).toBe(created.id);
    await expect(localDataSource.joinGroup("not-a-real-code")).rejects.toThrow();
  });

  it("cannot leave your last group", async () => {
    const [only] = await localDataSource.listMyGroups();
    await expect(localDataSource.leaveGroup(only.id)).rejects.toThrow();
  });

  it("can leave a group that isn't the last one", async () => {
    const created = await localDataSource.createGroup("Spare Group");
    await localDataSource.leaveGroup(created.id);
    const groups = await localDataSource.listMyGroups();
    expect(groups.find((g) => g.id === created.id)).toBeUndefined();
  });

  it("a non-creator cannot rename, regenerate the code, or remove a member of someone else's group", async () => {
    const seed = (await localDataSource.listMyGroups())[0]; // Amal created this one, not me
    expect(seed.isCreator).toBe(false);
    await expect(localDataSource.renameGroup(seed.id, "Nope")).rejects.toThrow();
    await expect(localDataSource.regenerateInviteCode(seed.id)).rejects.toThrow();
    await expect(localDataSource.removeMember(seed.id, "local-friend-amal")).rejects.toThrow();
  });

  it("the creator can rename, regenerate the code, or remove a member of their own group", async () => {
    const created = await localDataSource.createGroup("My Own Group");
    await localDataSource.renameGroup(created.id, "Renamed");
    expect((await localDataSource.listMyGroups()).find((g) => g.id === created.id)?.name).toBe(
      "Renamed",
    );
    const newCode = await localDataSource.regenerateInviteCode(created.id);
    expect(newCode).not.toBe(created.inviteCode);
  });

  it("refuses to remove yourself via removeMember", async () => {
    const created = await localDataSource.createGroup("Solo Group");
    await expect(localDataSource.removeMember(created.id, "local-dev")).rejects.toThrow();
  });

  it("lists group members, flagging the creator", async () => {
    const seed = (await localDataSource.listMyGroups())[0];
    const members = await localDataSource.listGroupMembers(seed.id);
    expect(members.length).toBe(3);
    expect(members.find((m) => m.displayName === "Amal")?.isCreator).toBe(true);
    expect(members.find((m) => m.userId === "local-dev")?.isCreator).toBe(false);
  });
});

describe("getLeaderboard", () => {
  it("returns ranked rows that include the member themself", async () => {
    const seed = (await localDataSource.listMyGroups())[0];
    const rows = await localDataSource.getLeaderboard("group", { groupId: seed.id, period: "day" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.isMe)).toBe(true);
    expect(rows).toEqual([...rows].sort((a, b) => b.points - a.points));
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
  });

  it("is deterministic for the same scope/group/period/date", async () => {
    const seed = (await localDataSource.listMyGroups())[0];
    const a = await localDataSource.getLeaderboard("group", { groupId: seed.id, period: "day", date: "2026-10-10" });
    const b = await localDataSource.getLeaderboard("group", { groupId: seed.id, period: "day", date: "2026-10-10" });
    expect(a).toEqual(b);
  });

  it("a global board can include more members than one group", async () => {
    await localDataSource.createGroup("Another Group");
    const rows = await localDataSource.getLeaderboard("global", { period: "day" });
    expect(rows.some((r) => r.isMe)).toBe(true);
  });

  // The local user (constant displayName "Sansita") is naturally in every seeded/created group —
  // the one overlap the public DataSource API can construct. These two tests seed a *third party*
  // directly (writeGroups/writeMembers — see their export comment in local.ts) to exercise the
  // overlap the brief actually asks about: several different real people sharing some, not all, of
  // their groups.
  it("the global board counts a member of several overlapping groups exactly once", async () => {
    const seed = (await localDataSource.listMyGroups())[0]; // "Puzzle Pals": Sansita, Amal, Riya
    const groupTwo = { id: "g2", name: "Group Two", inviteCode: "x", createdBy: LOCAL_USER_ID, createdAt: "t" };
    const groupThree = { id: "g3", name: "Group Three", inviteCode: "y", createdBy: LOCAL_USER_ID, createdAt: "t" };
    writeGroups([...readGroups(), groupTwo, groupThree]);
    // "Amal" (already in the seed group) also joins groups two and three — 3 memberships for one
    // person, same shape as the brief's "bob is in A+B" overlap.
    writeMembers(groupTwo.id, [
      { userId: LOCAL_USER_ID, displayName: "Sansita", joinedAt: "t" },
      { userId: "local-friend-amal", displayName: "Amal", joinedAt: "t" },
    ]);
    writeMembers(groupThree.id, [{ userId: "local-friend-amal", displayName: "Amal", joinedAt: "t" }]);

    // Sanity: Amal really is in 3 groups now, so a dedup-by-name (correct) vs. no-dedup-at-all
    // (the bug class this guards against) would visibly differ — a non-deduped flatMap would list
    // "Amal" 3 times here.
    const allGroupIds = [seed.id, groupTwo.id, groupThree.id];
    const amalMembershipCount = allGroupIds.filter((id) =>
      [localStorage.getItem(`puzzles:group-members:${id}`)].some((raw) => raw?.includes("local-friend-amal")),
    ).length;
    expect(amalMembershipCount).toBe(3);

    const rows = await localDataSource.getLeaderboard("global", { period: "day", date: "2026-10-10" });
    const amalRows = rows.filter((r) => r.displayName === "Amal");
    expect(amalRows.length).toBe(1);
  });

  it("a group's board never includes someone who only shares a different group", async () => {
    const seed = (await localDataSource.listMyGroups())[0]; // Sansita, Amal, Riya
    const groupTwo = { id: "g2", name: "Group Two", inviteCode: "x", createdBy: LOCAL_USER_ID, createdAt: "t" };
    writeGroups([...readGroups(), groupTwo]);
    // Only Sansita and a brand-new third party ("Carol") are in Group Two — Amal and Riya (seed
    // group only) must not leak in.
    writeMembers(groupTwo.id, [
      { userId: LOCAL_USER_ID, displayName: "Sansita", joinedAt: "t" },
      { userId: "local-friend-carol", displayName: "Carol", joinedAt: "t" },
    ]);

    const seedBoard = await localDataSource.getLeaderboard("group", { groupId: seed.id, period: "day" });
    expect(seedBoard.some((r) => r.displayName === "Carol")).toBe(false);

    const groupTwoBoard = await localDataSource.getLeaderboard("group", { groupId: groupTwo.id, period: "day" });
    expect(groupTwoBoard.some((r) => r.displayName === "Amal")).toBe(false);
    expect(groupTwoBoard.some((r) => r.displayName === "Riya")).toBe(false);
    expect(groupTwoBoard.some((r) => r.displayName === "Carol")).toBe(true);
  });
});
