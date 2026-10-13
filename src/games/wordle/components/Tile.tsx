import { useEffect, useState } from "react";
import { motion, useReducedMotion, type MotionValue } from "motion/react";

export type TileVisualState = "empty" | "filled" | "correct" | "present" | "absent";

export const FLIP_DURATION = 0.5;
export const FLIP_STAGGER = 0.12;

const COLOR_CLASS: Record<TileVisualState, string> = {
  empty: "border-game-border bg-tile-empty text-tile-fg",
  filled: "border-tile-fg bg-tile-filled text-tile-fg",
  correct: "border-tile-correct bg-tile-correct text-white",
  present: "border-tile-present bg-tile-present text-white",
  absent: "border-tile-absent bg-tile-absent text-white",
};

const STATE_LABEL: Record<TileVisualState, string> = {
  empty: "empty",
  filled: "",
  correct: "correct",
  present: "present elsewhere",
  absent: "not in word",
};

export interface TileProps {
  letter: string;
  state: TileVisualState;
  /** Play the flip-reveal animation for this tile (the row just submitted). */
  flip?: boolean;
  /** Seconds before this tile's own flip starts (staggered across the row). */
  delay?: number;
  shake?: boolean;
  /** Fires once, after this tile's flip animation (or its reduced-motion equivalent) finishes. */
  onRevealed?: () => void;
  /** From `useSlotSpring`, for the in-progress row only: springs the letter up into place as it's
   *  typed and back down on backspace. Omitted for historical/revealing rows — those letters are
   *  already settled, this is only the typing feedback, decoupled from the flip-reveal above. */
  slotStyle?: { transform: MotionValue<string>; opacity: MotionValue<number> };
  /** This is the tile the next typed letter lands in — ringed with `--tile-selected` (already
   *  defined in theme.css, previously unused). Only ever true for one empty tile at a time. */
  cursor?: boolean;
}

/**
 * One board cell. The flip animation and the colour swap are deliberately decoupled: the tile
 * rotates through 90° (edge-on) over `FLIP_DURATION`, and the colour swaps to its final state at
 * exactly that midpoint — not before (would spoil the flip) and not after (would look like the
 * colour pops in after the tile has already turned back to face the player). See RESEARCH.md.
 */
export function Tile({
  letter,
  state,
  flip = false,
  delay = 0,
  shake = false,
  onRevealed,
  slotStyle,
  cursor = false,
}: TileProps) {
  const reducedMotion = useReducedMotion();
  const [displayState, setDisplayState] = useState<TileVisualState>(flip ? "filled" : state);

  // Not flipping (the empty/filled row the player is typing, or an already-revealed historical
  // row): track `state` directly, so e.g. empty -> filled updates as the player types.
  useEffect(() => {
    if (!flip) setDisplayState(state);
  }, [flip, state]);

  // Flipping: swap to the final colour at the midpoint, not on every `state`/`onRevealed`
  // identity change — only when a reveal actually starts (`flip` becomes true).
  useEffect(() => {
    if (!flip) return;
    if (reducedMotion) {
      setDisplayState(state);
      onRevealed?.();
      return;
    }
    const midpointMs = (delay + FLIP_DURATION / 2) * 1000;
    const endMs = (delay + FLIP_DURATION) * 1000;
    const midTimer = setTimeout(() => setDisplayState(state), midpointMs);
    const endTimer = setTimeout(() => onRevealed?.(), endMs);
    return () => {
      clearTimeout(midTimer);
      clearTimeout(endTimer);
    };
  }, [flip]);

  const label = letter
    ? `${letter}${STATE_LABEL[displayState] ? `, ${STATE_LABEL[displayState]}` : ""}`
    : "empty";

  return (
    <motion.div
      role="img"
      aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-tile border-2 font-game text-2xl font-bold uppercase sm:h-14 sm:w-14 sm:text-3xl ${COLOR_CLASS[displayState]} ${cursor ? "ring-2 ring-tile-selected ring-offset-2 ring-offset-game-bg" : ""}`}
      style={{ transformStyle: "preserve-3d" }}
      animate={
        shake
          ? { x: [0, -8, 8, -8, 8, 0] }
          : flip && !reducedMotion
            ? { rotateX: [0, 90, 0] }
            : { rotateX: 0 }
      }
      transition={
        shake
          ? { duration: 0.4, ease: "easeInOut" }
          : flip && !reducedMotion
            ? { duration: FLIP_DURATION, delay, ease: "easeIn", times: [0, 0.5, 1] }
            : { duration: 0 }
      }
    >
      {slotStyle ? <motion.span style={slotStyle}>{letter}</motion.span> : letter}
    </motion.div>
  );
}
