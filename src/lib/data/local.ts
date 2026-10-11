// Dev adapter: content/puzzles/<id>/<date>.json served by the Vite dev-server middleware in
// vite.config.ts (never bundled — see that file's comment), plays and stats in localStorage.
//
// Content file shape, one per day, used by every game's generator and by scripts/upload-puzzles.ts:
//   { "payload": <game-specific main puzzle>, "reserve": <game-specific reserve puzzle> | null }
import type { DataSource, FinaleMessage, Group, GroupMember, LeaderboardRow, Play, PlayStatus } from "./types";
import { todayKey, addDays, mulberry32 } from "../daily";
import { BIRTHDAY } from "../../config";

const PLAY_PREFIX = "puzzles:play:";

interface StoredPlay<S = unknown> extends Play<S> {
  /** The IST calendar day (todayKey()) this play was started on — may differ from `date` for an
   *  archive catch-up. Used to decide whether a win extends a streak, mirroring the database's
   *  `started_at at time zone 'Asia/Kolkata' = puzzle_date` check. Not part of the public Play shape. */
  startedOn: string;
}

function playKey(gameId: string, date: string): string {
  return `${PLAY_PREFIX}${gameId}:${date}`;
}

function readPlay<S>(gameId: string, date: string): StoredPlay<S> | null {
  const raw = localStorage.getItem(playKey(gameId, date));
  return raw ? (JSON.parse(raw) as StoredPlay<S>) : null;
}

function writePlay<S>(play: StoredPlay<S>): void {
  localStorage.setItem(playKey(play.gameId, play.date), JSON.stringify(play));
}

function gameIdsInStorage(): string[] {
  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PLAY_PREFIX)) ids.add(key.slice(PLAY_PREFIX.length).split(":")[0]);
  }
  return [...ids];
}

function allPlaysFor(gameId: string): StoredPlay[] {
  const prefix = `${PLAY_PREFIX}${gameId}:`;
  const plays: StoredPlay[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const raw = localStorage.getItem(key);
      if (raw) plays.push(JSON.parse(raw) as StoredPlay);
    }
  }
  return plays;
}

function isEmptyState(state: unknown): boolean {
  return JSON.stringify(state ?? {}) === "{}";
}

interface Stats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
}

function computeStats(plays: StoredPlay[]): Stats {
  const finished = plays.filter((p) => p.status !== "in_progress");
  const played = finished.length;
  const won = finished.filter((p) => p.status === "won").length;

  const onDayWinDates = finished
    .filter((p) => p.status === "won" && p.startedOn === p.date)
    .map((p) => p.date)
    .sort();

  const islands: { lastDay: string; len: number }[] = [];
  for (const date of onDayWinDates) {
    const last = islands[islands.length - 1];
    if (last && addDays(last.lastDay, 1) === date) {
      last.lastDay = date;
      last.len += 1;
    } else {
      islands.push({ lastDay: date, len: 1 });
    }
  }

  const today = todayKey();
  const yesterday = addDays(today, -1);
  const todaysIsland = islands.find((i) => i.lastDay === today);
  const yesterdaysIsland = islands.find((i) => i.lastDay === yesterday);
  const playedToday = finished.some((p) => p.date === today);

  const currentStreak = todaysIsland
    ? todaysIsland.len
    : !playedToday && yesterdaysIsland
      ? yesterdaysIsland.len
      : 0;
  const maxStreak = islands.reduce((max, i) => Math.max(max, i.len), 0);

  return { played, won, currentStreak, maxStreak };
}

function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return h >>> 0;
}

async function fetchContent<T>(
  gameId: string,
  date: string,
): Promise<{ payload: T; reserve?: T | null } | null> {
  const res = await fetch(`/__content/${gameId}/${date}.json`);
  if (!res.ok) return null;
  const data = (await res.json()) as { payload: T; reserve?: T | null } | null;
  return data;
}

const FAKE_FRIENDS = ["Amal", "Riya"];

// ───────────────────────── Groups (dev fixture) ─────────────────────────
// A believable fake friend group, stored in localStorage so it survives a reload. The local dev
// adapter only ever plays as one member — see FAKE_MEMBER in lib/auth.tsx — identified the same
// way here (not imported, to avoid a local.ts ⇄ auth.tsx ⇄ data/index.ts import cycle).
const LOCAL_USER_ID = "local-dev";
const LOCAL_DISPLAY_NAME = "Sansita";
const GROUPS_KEY = "puzzles:groups";
const GROUP_MEMBERS_PREFIX = "puzzles:group-members:";

interface StoredGroup {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
}
interface StoredGroupMember {
  userId: string;
  displayName: string;
  joinedAt: string;
}

function readGroups(): StoredGroup[] {
  const raw = localStorage.getItem(GROUPS_KEY);
  return raw ? (JSON.parse(raw) as StoredGroup[]) : [];
}

function writeGroups(groups: StoredGroup[]): void {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function readMembers(groupId: string): StoredGroupMember[] {
  const raw = localStorage.getItem(`${GROUP_MEMBERS_PREFIX}${groupId}`);
  return raw ? (JSON.parse(raw) as StoredGroupMember[]) : [];
}

function writeMembers(groupId: string, members: StoredGroupMember[]): void {
  localStorage.setItem(`${GROUP_MEMBERS_PREFIX}${groupId}`, JSON.stringify(members));
}

const INVITE_ADJECTIVES = ["amber", "bright", "calm", "coral", "dusty", "honey", "jolly", "mellow"];
const INVITE_NOUNS = ["otter", "maple", "comet", "pebble", "willow", "harbor", "lantern", "ember"];

function randomInviteCode(): string {
  const adj = INVITE_ADJECTIVES[Math.floor(Math.random() * INVITE_ADJECTIVES.length)];
  const noun = INVITE_NOUNS[Math.floor(Math.random() * INVITE_NOUNS.length)];
  const num = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${adj}-${noun}-${num}`;
}

/** Seeds one believable group — "Puzzle Pals", created by a fake friend (not the local user, same
 *  as real onboarding: you join a group someone else made) with both fake friends already in it —
 *  the first time anything group-related is read, so a fresh dev environment isn't empty. */
function ensureSeedGroup(): void {
  if (readGroups().length > 0) return;
  const creatorId = `local-friend-${FAKE_FRIENDS[0].toLowerCase()}`;
  const group: StoredGroup = {
    id: "local-group-seed",
    name: "Puzzle Pals",
    inviteCode: "sunny-otter-01",
    createdBy: creatorId,
    createdAt: new Date().toISOString(),
  };
  writeGroups([group]);
  writeMembers(group.id, [
    { userId: LOCAL_USER_ID, displayName: LOCAL_DISPLAY_NAME, joinedAt: group.createdAt },
    ...FAKE_FRIENDS.map((name) => ({
      userId: `local-friend-${name.toLowerCase()}`,
      displayName: name,
      joinedAt: group.createdAt,
    })),
  ]);
}

function toGroup(stored: StoredGroup): Group {
  return {
    id: stored.id,
    name: stored.name,
    inviteCode: stored.inviteCode,
    memberCount: readMembers(stored.id).length,
    isCreator: stored.createdBy === LOCAL_USER_ID,
  };
}

// Dev-only threshold for unlocking the finale locally — the real one is whatever `required_games`
// the human sets on her `messages` row (see PLAN.md's SQL snippet), enforced by the database.
const FINALE_REQUIRED_GAMES = 3;

// Dev-only placeholder — see PLAN.md's SQL insert for the real message's content shape.
const PLACEHOLDER_FINALE_MESSAGE: FinaleMessage = {
  title: "Happy Birthday, Sansita!",
  body: "A whole year of puzzles made just for you. Here's to today, and every day after it.",
  photos: [],
  video: null,
};

function distinctGamesFinishedOn(date: string): number {
  const finished = new Set<string>();
  for (const gameId of gameIdsInStorage()) {
    if (allPlaysFor(gameId).some((p) => p.date === date && p.status !== "in_progress")) {
      finished.add(gameId);
    }
  }
  return finished.size;
}

export const localDataSource: DataSource = {
  async getPuzzle<T>(gameId: string, date: string) {
    if (date > todayKey()) return null; // never released
    const content = await fetchContent<T>(gameId, date);
    if (!content) return null;
    return { main: content.payload, reserve: content.reserve ?? undefined };
  },

  async getPlay<S>(gameId: string, date: string): Promise<Play<S> | null> {
    return readPlay<S>(gameId, date);
  },

  async startPlay(gameId: string, date: string, variant: "main" | "reserve" = "main") {
    if (date > todayKey()) throw new Error("cannot start a puzzle that hasn't been released yet");
    if (readPlay(gameId, date)) throw new Error("this puzzle has already been started");
    const play: StoredPlay = {
      gameId,
      date,
      variant,
      status: "in_progress",
      state: {},
      startedOn: todayKey(),
    };
    writePlay(play);
    return play;
  },

  async savePlay<S>(
    gameId: string,
    date: string,
    patch: Partial<Pick<Play<S>, "state" | "variant">>,
  ) {
    const existing = readPlay<S>(gameId, date);
    if (!existing) throw new Error("no play to save — call start() first");
    if (existing.status !== "in_progress") throw new Error("this puzzle has already been played");
    if (
      patch.variant !== undefined &&
      patch.variant !== existing.variant &&
      !isEmptyState(existing.state)
    ) {
      throw new Error("cannot switch to the reserve puzzle after starting");
    }
    writePlay({ ...existing, ...patch });
  },

  async finishPlay(
    gameId: string,
    date: string,
    result: { won: boolean; state: unknown; summary: string; score?: number },
  ) {
    const existing = readPlay(gameId, date);
    if (!existing) throw new Error("no play to finish — call start() first");
    if (existing.status !== "in_progress") throw new Error("this puzzle has already been played");
    writePlay({
      ...existing,
      status: result.won ? "won" : "lost",
      state: result.state,
      summary: result.summary,
      score: result.score,
    });
  },

  async getStats() {
    const result: Record<string, Stats> = {};
    for (const gameId of gameIdsInStorage()) result[gameId] = computeStats(allPlaysFor(gameId));
    return result;
  },

  async getFriendsResults(gameId: string, date: string, _groupId: string) {
    const mine = readPlay(gameId, date);
    if (!mine || mine.status === "in_progress") return [];
    const rng = mulberry32(hashString(`${gameId}:${date}`));
    return FAKE_FRIENDS.map((name) => {
      const won = rng() > 0.3;
      return {
        name,
        status: (won ? "won" : "lost") as PlayStatus,
        summary: won ? `${gameId} — solved it` : `${gameId} — so close`,
        score: won ? Math.ceil(rng() * 6) : undefined,
      };
    });
  },

  async listPlays(gameId: string) {
    return allPlaysFor(gameId)
      .map((p) => ({ date: p.date, status: p.status, score: p.score }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  },

  async getMessage(): Promise<FinaleMessage | null> {
    // Mirrors "recipient reads unlocked messages" in 0001_init.sql: unlock_date <= today, and
    // enough distinct games finished *on unlock_date* (archive catch-ups for other days don't
    // count). Local dev only ever has one recipient (the fake member), so unlock_date is just
    // BIRTHDAY itself.
    if (todayKey() < BIRTHDAY) return null;
    if (distinctGamesFinishedOn(BIRTHDAY) < FINALE_REQUIRED_GAMES) return null;
    return PLACEHOLDER_FINALE_MESSAGE;
  },

  async listMyGroups(): Promise<Group[]> {
    ensureSeedGroup();
    return readGroups()
      .filter((g) => readMembers(g.id).some((m) => m.userId === LOCAL_USER_ID))
      .map(toGroup);
  },

  async createGroup(name: string): Promise<{ id: string; inviteCode: string }> {
    ensureSeedGroup();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      throw new Error("Name must be between 1 and 40 characters.");
    }
    const groups = readGroups();
    if (groups.filter((g) => g.createdBy === LOCAL_USER_ID).length >= 3) {
      throw new Error("You can create at most 3 groups.");
    }
    const group: StoredGroup = {
      // Date.now() alone can collide under fake timers (tests create several groups within the
      // same frozen millisecond) — the random suffix keeps ids unique regardless.
      id: `local-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      inviteCode: randomInviteCode(),
      createdBy: LOCAL_USER_ID,
      createdAt: new Date().toISOString(),
    };
    writeGroups([...groups, group]);
    writeMembers(group.id, [
      { userId: LOCAL_USER_ID, displayName: LOCAL_DISPLAY_NAME, joinedAt: group.createdAt },
    ]);
    return { id: group.id, inviteCode: group.inviteCode };
  },

  async joinGroup(code: string): Promise<{ id: string; name: string }> {
    ensureSeedGroup();
    const group = readGroups().find(
      (g) => g.inviteCode.toLowerCase() === code.trim().toLowerCase(),
    );
    if (!group) throw new Error("That invite code isn't right.");
    const members = readMembers(group.id);
    if (!members.some((m) => m.userId === LOCAL_USER_ID)) {
      writeMembers(group.id, [
        ...members,
        { userId: LOCAL_USER_ID, displayName: LOCAL_DISPLAY_NAME, joinedAt: new Date().toISOString() },
      ]);
    }
    return { id: group.id, name: group.name };
  },

  async previewGroup(code: string): Promise<{ id: string; name: string } | null> {
    ensureSeedGroup();
    const group = readGroups().find(
      (g) => g.inviteCode.toLowerCase() === code.trim().toLowerCase(),
    );
    return group ? { id: group.id, name: group.name } : null;
  },

  async leaveGroup(groupId: string): Promise<void> {
    ensureSeedGroup();
    const myGroups = readGroups().filter((g) =>
      readMembers(g.id).some((m) => m.userId === LOCAL_USER_ID),
    );
    if (myGroups.length <= 1) throw new Error("cannot leave your last group");
    writeMembers(
      groupId,
      readMembers(groupId).filter((m) => m.userId !== LOCAL_USER_ID),
    );
  },

  async renameGroup(groupId: string, name: string): Promise<void> {
    const groups = readGroups();
    const group = groups.find((g) => g.id === groupId);
    if (!group || group.createdBy !== LOCAL_USER_ID) {
      throw new Error("only the creator can rename this group");
    }
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      throw new Error("Name must be between 1 and 40 characters.");
    }
    writeGroups(groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)));
  },

  async regenerateInviteCode(groupId: string): Promise<string> {
    const groups = readGroups();
    const group = groups.find((g) => g.id === groupId);
    if (!group || group.createdBy !== LOCAL_USER_ID) {
      throw new Error("only the creator can regenerate the invite code");
    }
    const inviteCode = randomInviteCode();
    writeGroups(groups.map((g) => (g.id === groupId ? { ...g, inviteCode } : g)));
    return inviteCode;
  },

  async listGroupMembers(groupId: string): Promise<GroupMember[]> {
    const group = readGroups().find((g) => g.id === groupId);
    return readMembers(groupId).map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      isCreator: group?.createdBy === m.userId,
    }));
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    const group = readGroups().find((g) => g.id === groupId);
    if (!group || group.createdBy !== LOCAL_USER_ID) {
      throw new Error("only the creator can remove members");
    }
    if (userId === LOCAL_USER_ID) throw new Error("use leave_group to remove yourself");
    writeMembers(
      groupId,
      readMembers(groupId).filter((m) => m.userId !== userId),
    );
  },

  async getLeaderboard(
    scope: "group" | "global",
    opts: { groupId?: string; period: "day" | "week"; date?: string },
  ): Promise<LeaderboardRow[]> {
    ensureSeedGroup();
    const date = opts.date ?? todayKey();
    const groups = readGroups();
    const names =
      scope === "global"
        ? [...new Set(groups.flatMap((g) => readMembers(g.id).map((m) => m.displayName)))]
        : readMembers(opts.groupId ?? groups[0]?.id ?? "").map((m) => m.displayName);

    const rng = mulberry32(hashString(`leaderboard:${scope}:${opts.groupId ?? ""}:${opts.period}:${date}`));
    const rows = names
      .map((displayName) => {
        const gamesPlayed = Math.floor(rng() * 6);
        const wins = Math.floor(rng() * (gamesPlayed + 1));
        const points = wins + Math.floor(rng() * wins * 2);
        return { displayName, points, wins, gamesPlayed, isMe: displayName === LOCAL_DISPLAY_NAME };
      })
      .sort((a, b) => b.points - a.points);

    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  },
};
