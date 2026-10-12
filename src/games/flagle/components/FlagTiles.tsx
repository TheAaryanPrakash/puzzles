import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { GRID_COLS, GRID_ROWS, TOTAL_TILES } from "../logic";
import { noSwipeProps } from "../../../lib/noSwipe";

export interface FlagTilesProps {
  /** ISO 3166-1 alpha-2 code, lowercased for the flag-icons class. */
  code: string;
  /** Grid indices (0..TOTAL_TILES-1) still covering the flag. */
  hidden: number[];
  /** Once the round is over, lift every tile and show the flag in full. */
  revealed: boolean;
}

/** The flag, under a 2×3 grid of opaque tiles that lift (flip) one at a time as guesses are made. */
export function FlagTiles({ code, hidden, revealed }: FlagTilesProps) {
  const shouldReduceMotion = useReducedMotion();
  const hiddenSet = revealed ? new Set<number>() : new Set(hidden);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-tile border border-game-border bg-game-surface-2"
      style={{ perspective: "800px" }}
      {...noSwipeProps}
    >
      <div
        aria-hidden
        className={`fi fi-${code.toLowerCase()} absolute inset-0`}
        style={{ width: "100%", height: "100%", backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: TOTAL_TILES }, (_, i) => (
          <AnimatePresence key={i}>
            {hiddenSet.has(i) && (
              <motion.div
                className="border border-game-bg bg-game-surface-2"
                style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
                initial={false}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, rotateY: -100, scale: 0.85 }
                }
                transition={{ duration: shouldReduceMotion ? 0.001 : 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </AnimatePresence>
        ))}
      </div>
      <span className="sr-only" role="status">
        {revealed
          ? "Flag fully revealed."
          : `${TOTAL_TILES - hiddenSet.size} of ${TOTAL_TILES} tiles revealed.`}
      </span>
    </div>
  );
}
