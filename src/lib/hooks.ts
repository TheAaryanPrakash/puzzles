import { useCallback, useEffect, useRef, useState } from "react";
import { dataSource } from "./data";
import type { Play, PlayStatus } from "./data/types";
import { resolvePuzzleDate } from "./daily";
import { completeGame, type GameResult } from "./result";

const SAVE_DEBOUNCE_MS = 400;

export type PuzzleStatus = "loading" | "ready" | "missing";

export interface UsePuzzleResult<T> {
  date: string;
  puzzle: T | null;
  /**
   * The reserve payload, if this game has one for the day, regardless of the play's current
   * variant. Lets a game switch to it the instant `start("reserve")`/`save({ variant: "reserve" })`
   * resolves, without waiting for this hook to refetch — see `puzzle`'s resolution below for why
   * that refetch doesn't happen automatically.
   */
  reserve: T | null;
  status: PuzzleStatus;
}

/**
 * Loads today's puzzle — or, with `?day=` in the URL, that archive day's — respecting the play's
 * variant if one has been started. A game should never call `todayKey()` itself for this: always
 * use the `date` this hook returns, so GameLayout's Archive picker works with no game-side code.
 *
 * `puzzle` resolves the variant once, from whichever play exists when this effect first runs —
 * it does not react to a later `start("reserve")`/`save({ variant: "reserve" })` on the same
 * mount (that would need this hook to depend on `play`, which it does not fetch reactively). A
 * game that offers "skip to reserve" should use `reserve` directly once its own `play.variant`
 * becomes `"reserve"`, instead of relying on `puzzle` to update.
 */
export function usePuzzle<T>(gameId: string, date: string = resolvePuzzleDate()): UsePuzzleResult<T> {
  const [state, setState] = useState<{ status: PuzzleStatus; puzzle: T | null; reserve: T | null }>({
    status: "loading",
    puzzle: null,
    reserve: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", puzzle: null, reserve: null });

    void (async () => {
      const [puzzles, play] = await Promise.all([
        dataSource.getPuzzle<T>(gameId, date),
        dataSource.getPlay<unknown>(gameId, date),
      ]);
      if (cancelled) return;
      if (!puzzles) {
        setState({ status: "missing", puzzle: null, reserve: null });
        return;
      }
      const reserve = puzzles.reserve ?? null;
      const wantsReserve = play?.variant === "reserve";
      const puzzle = wantsReserve && reserve !== null ? reserve : puzzles.main;
      setState({ status: "ready", puzzle, reserve });
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, date]);

  return { date, puzzle: state.puzzle, reserve: state.reserve, status: state.status };
}

export interface UsePlayResult<S> {
  play: Play<S> | null;
  loading: boolean;
  start: (variant?: "main" | "reserve") => Promise<Play<S>>;
  save: (patch: Partial<Pick<Play<S>, "state" | "variant">>) => void;
  finish: (result: GameResult) => Promise<void>;
}

/**
 * Loads (and lets a game start, save and finish) its play for one date. `save` is debounced and
 * flushed immediately on tab hide/unload, so a move is never lost to a closed tab.
 */
export function usePlay<S>(gameId: string, date: string): UsePlayResult<S> {
  const [play, setPlay] = useState<Play<S> | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingPatchRef = useRef<Partial<Pick<Play<S>, "state" | "variant">> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void dataSource.getPlay<S>(gameId, date).then((p) => {
      if (!cancelled) {
        setPlay(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, date]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = null;
    if (patch) void dataSource.savePlay<S>(gameId, date, patch);
  }, [gameId, date]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const start = useCallback(
    async (variant: "main" | "reserve" = "main") => {
      const created = (await dataSource.startPlay(gameId, date, variant)) as Play<S>;
      setPlay(created);
      return created;
    },
    [gameId, date],
  );

  const save = useCallback(
    (patch: Partial<Pick<Play<S>, "state" | "variant">>) => {
      setPlay((prev) => (prev ? { ...prev, ...patch } : prev));
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const finish = useCallback(
    async (result: GameResult) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingPatchRef.current = null;
      await completeGame(dataSource, gameId, date, result);
      setPlay(
        (prev) =>
          ({
            ...prev,
            gameId,
            date,
            variant: prev?.variant ?? "main",
            status: result.won ? "won" : "lost",
            state: result.state,
            summary: result.summary,
            score: result.score,
          }) as Play<S>,
      );
    },
    [gameId, date],
  );

  return { play, loading, start, save, finish };
}

export interface GameStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
}

export interface UseStatsResult {
  stats: Record<string, GameStats>;
  loading: boolean;
  refresh: () => void;
}

/** All of the member's stats, one entry per game they've played. Call `refresh()` after finishing. */
export function useStats(): UseStatsResult {
  const [stats, setStats] = useState<Record<string, GameStats>>({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void dataSource.getStats().then((s) => {
      if (!cancelled) {
        setStats(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { stats, loading, refresh };
}

export interface FriendResult {
  name: string;
  status: PlayStatus;
  summary: string;
  score?: number;
}

export interface UseFriendsResultsResult {
  results: FriendResult[];
  loading: boolean;
}

/** Empty until the member has finished this puzzle themselves — never spoils it for them. */
export function useFriendsResults(gameId: string, date: string): UseFriendsResultsResult {
  const [results, setResults] = useState<FriendResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void dataSource.getFriendsResults(gameId, date).then((r) => {
      if (!cancelled) {
        setResults(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, date]);

  return { results, loading };
}

export interface PlaySummary {
  date: string;
  status: PlayStatus;
  score?: number;
}

export interface UsePlaysResult {
  plays: PlaySummary[];
  loading: boolean;
  refresh: () => void;
}

/**
 * Every play the member has for one game, sorted by date. Powers GameLayout's built-in Archive
 * button (which dates are already played) — a game can also use it to build its own stats, e.g. a
 * guess-distribution chart passed as ResultModal's/StatsModal's `statsExtraContent` from `score`.
 */
export function usePlays(gameId: string): UsePlaysResult {
  const [plays, setPlays] = useState<PlaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void dataSource.listPlays(gameId).then((p) => {
      if (!cancelled) {
        setPlays(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { plays, loading, refresh };
}
