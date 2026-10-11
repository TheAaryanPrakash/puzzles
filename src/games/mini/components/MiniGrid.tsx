import { motion, useReducedMotion } from "motion/react";
import type { Cursor, MiniPuzzle } from "../logic";

export interface MiniGridProps {
  puzzle: MiniPuzzle;
  letters: (string | null)[];
  cursor: Cursor;
  wordIndices: Set<number>;
  wrongIndices: Set<number>;
  readOnly?: boolean;
  onCellClick?: (row: number, col: number) => void;
}

/** The numbered 5x5/7x7 board. A plain CSS grid — no canvas, no absolute positioning per cell. */
export function MiniGrid({
  puzzle,
  letters,
  cursor,
  wordIndices,
  wrongIndices,
  readOnly,
  onCellClick,
}: MiniGridProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      className="mini-board"
      style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
      role="grid"
      aria-label="Crossword grid"
      aria-rowcount={puzzle.size}
      aria-colcount={puzzle.size}
    >
      {puzzle.cells.map((cell, i) => {
        const row = Math.floor(i / puzzle.size);
        const col = i % puzzle.size;
        if (cell === null) {
          return <div key={i} className="mini-cell is-black" aria-hidden="true" />;
        }
        const letter = letters[i];
        const isSelected = !readOnly && cursor.row === row && cursor.col === col;
        const isInWord = !readOnly && wordIndices.has(i);
        const isWrong = wrongIndices.has(i);
        return (
          <div
            key={i}
            role="gridcell"
            aria-rowindex={row + 1}
            aria-colindex={col + 1}
            aria-label={`${letter ?? "empty"}${cell.number ? `, clue ${cell.number}` : ""}`}
            className={[
              "mini-cell",
              isSelected ? "is-selected" : isInWord ? "is-in-word" : "",
              isWrong ? "is-wrong" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={readOnly ? undefined : () => onCellClick?.(row, col)}
          >
            {cell.number !== undefined && <span className="mini-cell-number">{cell.number}</span>}
            {letter && reduceMotion && <span>{letter}</span>}
            {letter && !reduceMotion && (
              <motion.span
                key={letter}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.12 }}
              >
                {letter}
              </motion.span>
            )}
          </div>
        );
      })}
    </div>
  );
}
