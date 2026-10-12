// Owns one friend game's live state: initial fetch, Realtime/BroadcastChannel subscription
// (via chessDataSource.subscribeToGame — reconnect/focus refetch included there), and optimistic
// move application with rollback on an RPC refusal (a second tab, or a stale page, loses the
// race and gets resynced to the server's actual state).
import { useEffect, useRef, useState } from "react";
import { Chess, type Move } from "chess.js";
import { chessDataSource, type ChessGame, type ChessResult } from "../../../lib/data/chess";
import { classifyEnd, type EndReason } from "../logic";

function neutralResult(c: Chess): { result: ChessResult; reason: EndReason } | undefined {
  // classifyEnd is written from one side's perspective (used as-is by the computer mode); fixing
  // that side to "white" here turns it into a neutral white_won/black_won/draw result instead —
  // reused, not forked.
  const end = classifyEnd(c, "white");
  if (!end) return undefined;
  const result: ChessResult = end.status === "won" ? "white_won" : end.status === "lost" ? "black_won" : "draw";
  return { result, reason: end.reason };
}

export interface UseFriendGameResult {
  game: ChessGame | null;
  loading: boolean;
  error: string | null;
  dismissError: () => void;
  /** Applies a chess.js move optimistically and sends it to the backend; rolls back on refusal. */
  applyMove: (c: Chess, move: Move) => void;
  resign: () => Promise<void>;
  offerDraw: () => Promise<void>;
  respondDraw: (accept: boolean) => Promise<void>;
  claimAbandoned: () => Promise<void>;
}

export function useFriendGame(gameId: string | null): UseFriendGameResult {
  const [game, setGame] = useState<ChessGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gameRef = useRef<ChessGame | null>(null);
  gameRef.current = game;

  useEffect(() => {
    if (!gameId) {
      setGame(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void chessDataSource.getGame(gameId).then((g) => {
      if (!cancelled) {
        setGame(g);
        setLoading(false);
      }
    });
    const unsubscribe = chessDataSource.subscribeToGame(gameId, (g) => {
      if (!cancelled) setGame(g);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [gameId]);

  function runOrRollback(action: () => Promise<void>, rollbackTo: ChessGame | null) {
    action().catch((err) => {
      setGame(rollbackTo);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    });
  }

  function applyMove(c: Chess, move: Move) {
    const base = gameRef.current;
    if (!base) return;
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    const fen = c.fen();
    const pgn = c.pgn();
    const expectedPly = base.ply;
    const ending = neutralResult(c);
    const nextIsMyTurn =
      !ending && base.myColor !== null && base.myColor === (move.color === "w" ? "black" : "white");
    const optimistic: ChessGame = {
      ...base,
      fen,
      pgn,
      lastMoveSan: move.san,
      ply: expectedPly + 1,
      drawOfferBy: null,
      status: ending ? "finished" : "active",
      result: ending?.result ?? null,
      reason: ending?.reason ?? null,
      isMyTurn: nextIsMyTurn,
    };
    setGame(optimistic);
    runOrRollback(
      () =>
        chessDataSource.makeMove({
          gameId: base.id,
          uci,
          san: move.san,
          fen,
          pgn,
          expectedPly,
          result: ending?.result,
          reason: ending?.reason,
        }),
      base,
    );
  }

  async function resign() {
    const base = gameRef.current;
    if (!base) return;
    await chessDataSource.resign(base.id).catch((err) => {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      throw err;
    });
  }

  async function offerDraw() {
    const base = gameRef.current;
    if (!base) return;
    const optimistic = { ...base, drawOfferBy: base.myColor === "white" ? base.whiteId : base.blackId };
    setGame(optimistic);
    runOrRollback(() => chessDataSource.offerDraw(base.id), base);
  }

  async function respondDraw(accept: boolean) {
    const base = gameRef.current;
    if (!base) return;
    await chessDataSource.respondDraw(base.id, accept).catch((err) => {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      throw err;
    });
  }

  async function claimAbandoned() {
    const base = gameRef.current;
    if (!base) return;
    await chessDataSource.claimAbandoned(base.id).catch((err) => {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      throw err;
    });
  }

  return {
    game,
    loading,
    error,
    dismissError: () => setError(null),
    applyMove,
    resign,
    offerDraw,
    respondDraw,
    claimAbandoned,
  };
}
