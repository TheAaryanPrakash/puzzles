import { useCallback, useEffect, useRef, useState } from "react";
import { dataSource } from "./data";
import type { Play, PlayStatus } from "./data/types";
import { todayKey } from "./daily";
import { completeGame, type GameResult } from "./result";

const SAVE_DEBOUNCE_MS = 400;

export type PuzzleStatus = "loading" | "ready" | "missing";

export interface UsePuzzleResult<T> {
  date: string;
  puzzle: T | null;
  status: PuzzleStatus;
}

/** Loads today's (or `date`'s) puzzle, respecting the play's variant if one has been started. */
export function usePuzzle<T>(gameId: string, date: string = todayKey()): UsePuzzleResult<T> {
  const [state, setState] = useState<{ status: PuzzleStatus; puzzle: T | null }>({
    status: "loading",
    puzzle: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", puzzle: null });

    void (async () => {
      const [puzzles, play] = await Promise.all([
        dataSource.getPuzzle<T>(gameId, date),
        dataSource.getPlay<unknown>(gameId, date),
      ]);
      if (cancelled) return;
      if (!puzzles) {
        setState({ status: "missing", puzzle: null });
        return;
      }
      const wantsReserve = play?.variant === "reserve";
      const puzzle =
        wantsReserve && puzzles.reserve !== undefined ? puzzles.reserve : puzzles.main;
      setState({ status: "ready", puzzle });
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, date]);

  return { date, puzzle: state.puzzle, status: state.status };
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
