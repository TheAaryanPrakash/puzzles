import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { checkpointAt, type Cell, type ZipPuzzle } from "../logic";

// Keep these two in sync with theme.css's --zip-path-start/--zip-path-end: SVG `stroke` can't
// portably resolve a gradient-along-a-path from a CSS custom property, so the tube's color is
// interpolated here in JS instead.
const PATH_START = [0xe7, 0xa5, 0x40]; // #e7a540
const PATH_END = [0x87, 0x60, 0xbe]; // #8760be
const STROKE_WIDTH = 0.26;

function pathColorAt(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [r, g, b] = PATH_START.map((start, i) => Math.round(start + (PATH_END[i] - start) * clamped));
  return `rgb(${r}, ${g}, ${b})`;
}

interface ZipGridProps {
  puzzle: ZipPuzzle;
  path: Cell[];
  onInteract?: (cell: Cell) => void;
  readOnly?: boolean;
  /** Smaller, non-interactive rendering used inside ResultModal's finished-board preview. */
  compact?: boolean;
}

export function ZipGrid({ puzzle, path, onInteract, readOnly, compact }: ZipGridProps) {
  const { size } = puzzle;
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastCellRef = useRef<Cell | null>(null);
  const reducedMotion = useReducedMotion();

  const gridTemplate = { gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` };
  const totalSegments = size * size - 1;
  const interactive = !readOnly && !!onInteract;

  function cellFromClientPoint(clientX: number, clientY: number): Cell | null {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * size);
    const row = Math.floor(((clientY - rect.top) / rect.height) * size);
    if (row < 0 || row >= size || col < 0 || col >= size) return null;
    return { row, col };
  }

  function interact(cell: Cell | null) {
    if (!cell || !onInteract) return;
    if (lastCellRef.current && lastCellRef.current.row === cell.row && lastCellRef.current.col === cell.col) return;
    lastCellRef.current = cell;
    onInteract(cell);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!interactive) return;
    containerRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    lastCellRef.current = null;
    interact(cellFromClientPoint(e.clientX, e.clientY));
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!interactive || !draggingRef.current) return;
    interact(cellFromClientPoint(e.clientX, e.clientY));
  }

  function endDrag(e: React.PointerEvent) {
    draggingRef.current = false;
    lastCellRef.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }

  const cells = Array.from({ length: size * size }, (_, i) => ({ row: Math.floor(i / size), col: i % size }));
  const head = path[path.length - 1];

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={`Zip puzzle grid, ${size} by ${size}`}
      className={`relative aspect-square w-full touch-none select-none ${compact ? "max-w-[160px]" : "max-w-[420px]"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Cell backgrounds */}
      <div className="absolute inset-0 grid overflow-hidden rounded-tile border border-game-border" style={gridTemplate}>
        {cells.map((c) => (
          <div key={`${c.row},${c.col}`} className="border border-game-border/50 bg-game-surface" />
        ))}
      </div>

      {/* Walls + path tube + head marker */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {puzzle.walls.map((w, i) => {
          const sameRow = w.a.row === w.b.row;
          if (sameRow) {
            const x = Math.max(w.a.col, w.b.col);
            return (
              <line key={i} x1={x} y1={w.a.row} x2={x} y2={w.a.row + 1} stroke="var(--zip-wall)" strokeWidth={0.09} strokeLinecap="round" />
            );
          }
          const y = Math.max(w.a.row, w.b.row);
          return (
            <line key={i} x1={w.a.col} y1={y} x2={w.a.col + 1} y2={y} stroke="var(--zip-wall)" strokeWidth={0.09} strokeLinecap="round" />
          );
        })}

        {path.slice(0, -1).map((cell, i) => {
          const next = path[i + 1];
          const t = totalSegments > 1 ? i / (totalSegments - 1) : 0;
          return (
            <motion.line
              key={`${cell.row}-${cell.col}-${next.row}-${next.col}`}
              x1={cell.col + 0.5}
              y1={cell.row + 0.5}
              x2={next.col + 0.5}
              y2={next.row + 0.5}
              stroke={pathColorAt(t)}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}

        {head && (
          <motion.circle
            r={STROKE_WIDTH * 0.85}
            fill="var(--zip-checkpoint-bg)"
            stroke={pathColorAt(totalSegments > 1 ? (path.length - 1) / (totalSegments - 1) : 0)}
            strokeWidth={0.07}
            initial={false}
            animate={{ cx: head.col + 0.5, cy: head.row + 0.5 }}
            transition={{ duration: reducedMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>

      {/* Checkpoint badges, on top so the tube passing underneath never obscures a number */}
      <div className="pointer-events-none absolute inset-0 grid" style={gridTemplate}>
        {cells.map((c) => {
          const checkpoint = checkpointAt(puzzle, c);
          return (
            <div key={`${c.row},${c.col}`} className="flex items-center justify-center p-[8%]">
              {checkpoint && (
                <span
                  className={`flex h-full w-full items-center justify-center rounded-full border-2 font-brand font-bold ${compact ? "text-[0.5rem]" : "text-sm sm:text-base"}`}
                  style={{ background: "var(--zip-checkpoint-bg)", borderColor: "var(--zip-checkpoint-ring)", color: "var(--game-fg)" }}
                >
                  {checkpoint.num}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
