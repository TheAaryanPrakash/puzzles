// Dev adapter: content/puzzles/<id>/<date>.json served by the Vite dev-server middleware in
// vite.config.ts (never bundled — see that file's comment), plays and stats in localStorage.
//
// Content file shape, one per day, used by every game's generator and by scripts/upload-puzzles.ts:
//   { "payload": <game-specific main puzzle>, "reserve": <game-specific reserve puzzle> | null }
import type { DataSource, Play, PlayStatus } from "./types";
import { todayKey, addDays, mulberry32 } from "../daily";

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

  async getFriendsResults(gameId: string, date: string) {
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
};
