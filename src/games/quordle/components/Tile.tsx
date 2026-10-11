import { motion } from "motion/react";
import type { LetterState } from "../../../lib/wordle-score";

interface TileProps {
  letter: string;
  state: LetterState | null;
  /** This tile is in the row currently being typed (not yet submitted/scored). */
  isCurrentRow: boolean;
  shake: boolean;
  reducedMotion: boolean;
  /** Column index — staggers the reveal flip left-to-right, Wordle's signature tell. */
  column: number;
}

const STATE_CLASSES: Record<LetterState, string> = {
  correct: "border-tile-correct bg-tile-correct text-white",
  present: "border-tile-present bg-tile-present text-white",
  absent: "border-tile-absent bg-tile-absent text-white",
};

export function Tile({ letter, state, isCurrentRow, shake, reducedMotion, column }: TileProps) {
  const filled = letter.length > 0;
  const stateClass = state
    ? STATE_CLASSES[state]
    : filled
      ? "border-game-border bg-tile-filled text-tile-fg"
      : "border-game-border bg-tile-empty text-tile-fg";

  const animate = shake
    ? { x: reducedMotion ? 0 : [0, -3, 3, -3, 3, 0] }
    : state
      ? { rotateX: reducedMotion ? 0 : [0, 90, 0] }
      : filled && isCurrentRow
        ? { scale: reducedMotion ? 1 : [0.82, 1.04, 1] }
        : { scale: 1 };

  const transition = shake
    ? { duration: 0.32 }
    : state
      ? { duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : column * 0.1 }
      : { duration: reducedMotion ? 0 : 0.12 };

  return (
    <motion.div
      className={`flex aspect-square items-center justify-center rounded-tile border text-[0.6rem] font-bold uppercase leading-none sm:text-xs ${stateClass}`}
      animate={animate}
      transition={transition}
    >
      {letter}
      <span className="sr-only">{state ?? (filled ? "typed" : "empty")}</span>
    </motion.div>
  );
}
