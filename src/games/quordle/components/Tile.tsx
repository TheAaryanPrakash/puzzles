import { motion, type MotionValue } from "motion/react";
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
  /** useSlotSpring's per-slot style for this column, shared across every board's current row —
   *  springs the letter up into the tile as it's typed, reverses on backspace. Only passed for the
   *  in-progress row; scored/empty-future rows render the letter plain. */
  slotStyle?: { transform: MotionValue<string>; opacity: MotionValue<number> };
}

const STATE_CLASSES: Record<LetterState, string> = {
  correct: "border-tile-correct bg-tile-correct text-white",
  present: "border-tile-present bg-tile-present text-white",
  absent: "border-tile-absent bg-tile-absent text-white",
};

export function Tile({ letter, state, isCurrentRow, shake, reducedMotion, column, slotStyle }: TileProps) {
  const filled = letter.length > 0;
  const stateClass = state
    ? STATE_CLASSES[state]
    : filled
      ? "border-game-border bg-tile-filled text-tile-fg"
      : "border-game-border bg-tile-empty text-tile-fg";

  // The typed-letter "pop" used to be a one-off scale keyframe here; it's now the shared
  // useSlotSpring rise/fade on the letter itself (see slotStyle below), so this only covers
  // shake-on-invalid and the submit flip.
  const animate = shake
    ? { x: reducedMotion ? 0 : [0, -3, 3, -3, 3, 0] }
    : state
      ? { rotateX: reducedMotion ? 0 : [0, 90, 0] }
      : { scale: 1 };

  const transition = shake
    ? { duration: 0.32 }
    : state
      ? { duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : column * 0.1 }
      : { duration: 0 };

  return (
    <motion.div
      className={`flex aspect-square items-center justify-center rounded-tile border text-[0.6rem] font-bold uppercase leading-none sm:text-xs ${stateClass}`}
      animate={animate}
      transition={transition}
    >
      {isCurrentRow && slotStyle ? <motion.span style={slotStyle}>{letter}</motion.span> : letter}
      <span className="sr-only">{state ?? (filled ? "typed" : "empty")}</span>
    </motion.div>
  );
}
