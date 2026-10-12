import { useEffect, useMemo, useState } from "react";
import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { ChessGame } from "../../../lib/data/chess";
import { Board, FILES } from "../components/Board";
import { MoveList } from "../components/MoveList";
import { CapturedPieces } from "../components/CapturedPieces";
import { PromotionPicker } from "../components/PromotionPicker";
import { GameResultModal } from "../components/GameResultModal";
import { Modal } from "../../../components/Modal";
import { Button } from "../../../components/Button";
import { kingSquare, isAbandonable, type GameStatus } from "../logic";
import { useFriendGame } from "./useFriendGame";

export interface GameViewProps {
  gameId: string;
  onBack: () => void;
  onRematch: (gameId: string) => void;
}

function friendStatus(game: ChessGame): Exclude<GameStatus, "in_progress"> {
  if (game.result === "draw") return "drawn";
  const myResult = game.myColor === "white" ? "white_won" : "black_won";
  return game.result === myResult ? "won" : "lost";
}

export function GameView({ gameId, onBack, onRematch }: GameViewProps) {
  const { game, loading, error, dismissError, applyMove, resign, offerDraw, respondDraw, claimAbandoned } =
    useFriendGame(gameId);

  const [selected, setSelected] = useState<Square | null>(null);
  const [cursorSquare, setCursorSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [resignConfirmOpen, setResignConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (game?.status !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [game?.status]);

  useEffect(() => {
    if (game && game.status !== "active") setResultOpen(true);
  }, [game?.status]);

  const chess = useMemo(() => {
    const c = new Chess();
    if (game) c.loadPgn(game.pgn);
    return c;
  }, [game?.pgn]);

  const isSpectator = game?.myColor == null;
  const interactive = Boolean(game) && game!.status === "active" && game!.isMyTurn && !isSpectator && !pendingPromotion && !resultOpen;
  const orientation = game?.myColor ?? "white";
  const legalTargets = selected ? chess.moves({ square: selected, verbose: true }).map((m) => m.to) : [];
  const checkSquare = chess.isCheck() ? kingSquare(chess, chess.turn()) : null;
  const historyVerbose = chess.history({ verbose: true });
  const lastMove =
    historyVerbose.length > 0
      ? { from: historyVerbose[historyVerbose.length - 1].from, to: historyVerbose[historyVerbose.length - 1].to }
      : null;
  const moveCount = Math.ceil(historyVerbose.length / 2);

  function attemptMove(from: Square, to: Square) {
    if (!interactive) return;
    const candidates = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (candidates.length === 0) {
      setSelected(null);
      return;
    }
    if (candidates.length > 1) {
      setPendingPromotion({ from, to });
      return;
    }
    setSelected(null);
    const c = new Chess(chess.fen());
    const applied = c.move({ from: candidates[0].from, to: candidates[0].to, promotion: candidates[0].promotion });
    if (applied) applyMove(c, applied);
  }

  function activateSquare(square: Square) {
    if (!interactive) return;
    if (selected === square) {
      setSelected(null);
      return;
    }
    if (selected && chess.moves({ square: selected, verbose: true }).some((m) => m.to === square)) {
      attemptMove(selected, square);
      return;
    }
    const piece = chess.get(square);
    const myColorCode = orientation === "white" ? "w" : "b";
    setSelected(piece && piece.color === myColorCode && chess.turn() === myColorCode ? square : null);
  }

  function resolvePromotion(piece: PieceSymbol) {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    const move = chess.moves({ square: from, verbose: true }).find((m) => m.to === to && m.promotion === piece);
    setPendingPromotion(null);
    if (move) {
      const c = new Chess(chess.fen());
      const applied = c.move({ from, to, promotion: piece });
      if (applied) applyMove(c, applied);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!game || document.querySelector('[role="dialog"]')) return;
      const base = cursorSquare ?? ("e4" as Square);
      const fileIdx = FILES.indexOf(base[0] as (typeof FILES)[number]);
      const rank = Number(base[1]);
      const flip = orientation === "black";
      function move(dxScreen: number, dyScreen: number) {
        const dFile = flip ? -dxScreen : dxScreen;
        const dRank = flip ? dyScreen : -dyScreen;
        const newFile = Math.min(7, Math.max(0, fileIdx + dFile));
        const newRank = Math.min(8, Math.max(1, rank + dRank));
        setCursorSquare(`${FILES[newFile]}${newRank}` as Square);
      }
      switch (e.key) {
        case "ArrowUp": e.preventDefault(); move(0, -1); return;
        case "ArrowDown": e.preventDefault(); move(0, 1); return;
        case "ArrowLeft": e.preventDefault(); move(-1, 0); return;
        case "ArrowRight": e.preventDefault(); move(1, 0); return;
        case "Enter":
        case " ":
          e.preventDefault();
          if (cursorSquare) activateSquare(cursorSquare);
          return;
        case "Escape":
          e.preventDefault();
          setSelected(null);
          return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (loading) return <p className="py-10 text-center text-game-muted">Loading game…</p>;
  if (!game) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-game-muted">This game isn't available — it may have been removed, or you don't have access.</p>
        <Button variant="secondary" onClick={onBack}>Back</Button>
      </div>
    );
  }

  const opponentName = game.myColor === "white" ? game.blackName : game.myColor === "black" ? game.whiteName : null;
  const opponentId = game.myColor === "white" ? game.blackId : game.myColor === "black" ? game.whiteId : null;
  const canClaimAbandoned =
    game.status === "active" && !game.isMyTurn && !isSpectator && isAbandonable(game.lastMoveAt, now);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {error && (
        <div role="alert" className="flex w-full max-w-[min(94vw,32rem)] items-center justify-between gap-2 rounded-brand-md bg-game-surface-2 px-3 py-2 text-sm">
          <span>{error}</span>
          <button type="button" onClick={dismissError} className="font-semibold underline">Dismiss</button>
        </div>
      )}

      <p className="text-balance text-center text-sm text-game-muted">
        {isSpectator
          ? `Watching ${game.whiteName} vs ${game.blackName}`
          : game.status !== "active"
            ? "Game finished"
            : game.isMyTurn
              ? "Your turn"
              : `Waiting for ${opponentName}`}
      </p>

      <Board
        fen={game.fen}
        orientation={orientation}
        selected={selected}
        legalTargets={legalTargets}
        lastMove={lastMove}
        checkSquare={checkSquare}
        cursorSquare={cursorSquare}
        interactive={interactive}
        onActivateSquare={activateSquare}
        onAttemptMove={attemptMove}
      />

      <CapturedPieces history={historyVerbose} />

      {!isSpectator && game.status === "active" && (
        <div className="flex w-full max-w-[min(94vw,32rem)] flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void offerDraw()} disabled={Boolean(game.drawOfferBy)}>
            Offer draw
          </Button>
          <Button variant="danger" size="sm" onClick={() => setResignConfirmOpen(true)}>
            Resign
          </Button>
          {canClaimAbandoned && (
            <Button variant="secondary" size="sm" onClick={() => void claimAbandoned()}>
              Claim win (opponent inactive 7+ days)
            </Button>
          )}
        </div>
      )}

      {!isSpectator && game.drawOfferBy && game.drawOfferBy !== (game.myColor === "white" ? game.whiteId : game.blackId) && (
        <div className="flex w-full max-w-[min(94vw,32rem)] items-center justify-between gap-2 rounded-brand-md border border-game-border bg-game-surface-2 px-3 py-2 text-sm">
          <span>{opponentName} offered a draw.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => void respondDraw(false)}>Decline</Button>
            <Button size="sm" onClick={() => void respondDraw(true)}>Accept</Button>
          </div>
        </div>
      )}

      <div className="w-full max-w-[min(94vw,32rem)]">
        <MoveList sanMoves={chess.history()} />
      </div>

      <PromotionPicker
        open={Boolean(pendingPromotion)}
        color={orientation === "white" ? "w" : "b"}
        onChoose={resolvePromotion}
        onCancel={() => {
          setPendingPromotion(null);
          setSelected(null);
        }}
      />

      {game.result && !isSpectator && (
        <GameResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          status={friendStatus(game)}
          reason={game.reason ?? "resignation"}
          moveCount={moveCount}
          pgn={chess.pgn()}
          opponentName={opponentName ?? undefined}
          onRematch={opponentId ? () => onRematch(game.id) : undefined}
        />
      )}

      <Modal open={resignConfirmOpen} onClose={() => setResignConfirmOpen(false)} title="Resign this game?">
        <div className="space-y-4">
          <p className="text-sm text-game-muted">This counts as a loss in your record.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResignConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setResignConfirmOpen(false);
                void resign();
              }}
            >
              Resign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
