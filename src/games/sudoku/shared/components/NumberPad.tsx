import { motion, useReducedMotion } from "motion/react";
import type { Grid } from "../engine";

export interface NumberPadProps {
  size: number;
  entries: Grid;
  disabled?: boolean;
  notesMode: boolean;
  onToggleNotes: () => void;
  onNumber: (value: number) => void;
  onErase: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

function countInGrid(entries: Grid, value: number): number {
  let count = 0;
  for (const row of entries) for (const v of row) if (v === value) count++;
  return count;
}

/** Cell-first number pad: pairs with Board's selection, and with a physical keyboard's digit keys. */
export function NumberPad({
  size,
  entries,
  disabled,
  notesMode,
  onToggleNotes,
  onNumber,
  onErase,
  onUndo,
  canUndo,
}: NumberPadProps) {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.93 };

  return (
    <div className="mx-auto flex w-full max-w-[min(92vw,28rem)] flex-col gap-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size <= 6 ? size : 5}, 1fr)` }}>
        {Array.from({ length: size }, (_, i) => i + 1).map((value) => {
          const complete = countInGrid(entries, value) >= size;
          return (
            <motion.button
              key={value}
              type="button"
              disabled={disabled || complete}
              onClick={() => onNumber(value)}
              whileTap={disabled || complete ? undefined : tap}
              aria-label={`Enter ${value}${notesMode ? " as a note" : ""}`}
              className="flex h-11 min-w-11 items-center justify-center rounded-brand-sm border border-game-border bg-game-surface text-lg font-semibold text-game-fg transition-colors duration-brand-fast hover:bg-game-surface-2 disabled:opacity-30"
            >
              {value}
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2">
        <motion.button
          type="button"
          onClick={onToggleNotes}
          whileTap={tap}
          aria-pressed={notesMode}
          aria-label="Notes mode"
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-brand-sm border px-3 text-sm font-semibold transition-colors duration-brand-fast ${
            notesMode
              ? "border-game-accent bg-game-accent text-game-accent-fg"
              : "border-game-border bg-game-surface text-game-fg hover:bg-game-surface-2"
          }`}
        >
          <span aria-hidden>✎</span> Notes
        </motion.button>
        <motion.button
          type="button"
          onClick={onErase}
          disabled={disabled}
          whileTap={disabled ? undefined : tap}
          aria-label="Erase cell"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-brand-sm border border-game-border bg-game-surface px-3 text-sm font-semibold text-game-fg transition-colors duration-brand-fast hover:bg-game-surface-2 disabled:opacity-30"
        >
          <span aria-hidden>⌫</span> Erase
        </motion.button>
        <motion.button
          type="button"
          onClick={onUndo}
          disabled={disabled || !canUndo}
          whileTap={disabled || !canUndo ? undefined : tap}
          aria-label="Undo"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-brand-sm border border-game-border bg-game-surface px-3 text-sm font-semibold text-game-fg transition-colors duration-brand-fast hover:bg-game-surface-2 disabled:opacity-30"
        >
          <span aria-hidden>↶</span> Undo
        </motion.button>
      </div>
    </div>
  );
}
