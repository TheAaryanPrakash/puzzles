import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Chess, type Square } from "chess.js";
import { Piece } from "./Piece";
import type { Side } from "../logic";
import { noSwipeProps } from "../../../lib/noSwipe";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const PIECE_NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const DRAG_THRESHOLD_PX = 6;

function squareColor(square: Square): "light" | "dark" {
  const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rank = Number(square[1]);
  return (file + rank) % 2 === 1 ? "dark" : "light";
}

function orderedSquares(orientation: Side): Square[] {
  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "white" ? FILES : ([...FILES].reverse() as unknown as typeof FILES);
  const squares: Square[] = [];
  for (const rank of ranks) for (const file of files) squares.push(`${file}${rank}` as Square);
  return squares;
}

interface DragState {
  from: Square;
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
  trackable: boolean;
}

export interface BoardProps {
  fen: string;
  orientation: Side;
  selected: Square | null;
  legalTargets: readonly Square[];
  lastMove: { from: Square; to: Square } | null;
  checkSquare: Square | null;
  cursorSquare: Square | null;
  hintSquares?: ReadonlySet<Square>;
  interactive: boolean;
  /** Fires for a plain tap/click/keyboard activation of a square — select, move-to-target, or
   *  deselect, all decided by the caller (which owns the actual game state). */
  onActivateSquare: (square: Square) => void;
  /** Fires once a drag gesture is released over a different square. */
  onAttemptMove: (from: Square, to: Square) => void;
}

/**
 * Hand-written board (no board library, per CLAUDE.md): an 8x8 grid of squares, each a plain
 * `<div>` carrying its own pointer handlers. Tap-to-move and drag-to-move both funnel through the
 * same two callbacks so the caller has one place that owns move legality — this component only
 * renders the position and reports gestures.
 */
export function Board({
  fen,
  orientation,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  cursorSquare,
  hintSquares,
  interactive,
  onActivateSquare,
  onAttemptMove,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const chess = new Chess(fen); // cheap for a single board; always derived straight from fen
  const squares = orderedSquares(orientation);
  const legalSet = new Set(legalTargets);

  function squareFromPoint(x: number, y: number): Square | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-square]");
    return (el?.dataset.square as Square | undefined) ?? null;
  }

  function handlePointerDown(square: Square, e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    const trackable = Boolean(chess.get(square));
    if (trackable) e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ from: square, pointerId: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, trackable });
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || e.pointerId !== drag.pointerId || !drag.trackable) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD_PX;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { from, moved, trackable } = drag;
    setDrag(null);
    if (moved && trackable) {
      const target = squareFromPoint(e.clientX, e.clientY);
      if (target && target !== from) onAttemptMove(from, target);
      return;
    }
    onActivateSquare(from);
  }

  const cursorPiece = cursorSquare ? chess.get(cursorSquare) : null;
  const announcement = cursorSquare
    ? `${cursorSquare}${cursorPiece ? `, ${cursorPiece.color === "w" ? "white" : "black"} ${PIECE_NAMES[cursorPiece.type]}` : ", empty"}`
    : "";

  const squareSizePx = (boardRef.current?.getBoundingClientRect().width ?? 0) / 8;

  return (
    <div
      ref={boardRef}
      className="relative mx-auto grid aspect-square w-full max-w-[min(94vw,32rem)] grid-cols-8 touch-none overflow-hidden rounded-brand-md border border-game-border shadow-brand-sm select-none"
      role="grid"
      aria-label="Chess board"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDrag(null)}
      {...noSwipeProps}
    >
      {squares.map((square) => {
        const piece = chess.get(square);
        const color = squareColor(square);
        const isLast = Boolean(lastMove) && (lastMove!.from === square || lastMove!.to === square);
        const isTarget = legalSet.has(square);
        const hideWhileDragging = drag?.moved && drag.from === square;
        const showFileLabel = orientation === "white" ? square[1] === "1" : square[1] === "8";
        const showRankLabel = orientation === "white" ? square[0] === "a" : square[0] === "h";
        return (
          <div
            key={square}
            data-square={square}
            data-color={color}
            data-last-move={isLast || undefined}
            data-check={checkSquare === square || undefined}
            data-selected={selected === square || undefined}
            data-cursor={cursorSquare === square || undefined}
            data-hint={hintSquares?.has(square) || undefined}
            className="chess-square"
            role="gridcell"
            aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}` : ""}`}
            onPointerDown={(e) => handlePointerDown(square, e)}
          >
            {showRankLabel && (
              <span className="chess-coord chess-coord-rank" data-color={color}>
                {square[1]}
              </span>
            )}
            {showFileLabel && (
              <span className="chess-coord chess-coord-file" data-color={color}>
                {square[0]}
              </span>
            )}
            {isTarget && <span className="chess-move-dot" data-capture={Boolean(piece) || undefined} />}
            {piece && !hideWhileDragging && <Piece type={piece.type} color={piece.color} draggable={interactive} />}
          </div>
        );
      })}

      {drag?.moved && drag.trackable && squareSizePx > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-20"
          style={{
            left: drag.x,
            top: drag.y,
            width: squareSizePx * 0.86,
            height: squareSizePx * 0.86,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Piece type={chess.get(drag.from)!.type} color={chess.get(drag.from)!.color} dragging className="h-full w-full" />
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
