import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GuessResult } from "../logic";
import { squaresForPct } from "../logic";

export interface GuessListProps {
  guesses: GuessResult[];
}

/** One feedback row per guess, newest at the top, sliding in as it's added — the squares use the
 *  same rounding rule as the share summary, so what a player sees mid-game matches what they'd
 *  share afterwards. */
export function GuessList({ guesses }: GuessListProps) {
  const reduceMotion = useReducedMotion();
  const ordered = [...guesses].reverse();

  if (ordered.length === 0) return null;

  return (
    <ol className="flex w-full max-w-sm flex-col gap-2" aria-label="Your guesses">
      <AnimatePresence initial={false}>
        {ordered.map((g) => (
          <motion.li
            key={g.code}
            layout
            initial={reduceMotion ? false : { opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
            className={`flex items-center justify-between gap-3 rounded-brand-md border px-3 py-2 text-sm ${
              g.correct
                ? "border-tile-correct bg-tile-correct/10"
                : "border-game-border bg-game-surface"
            }`}
          >
            <span className="font-medium text-game-fg">{g.name}</span>
            <span className="flex items-center gap-2 text-game-muted">
              {!g.correct && (
                <>
                  <span>{g.distanceKm.toLocaleString()} km</span>
                  <span aria-hidden className="text-base">
                    {g.arrow}
                  </span>
                </>
              )}
              <span aria-hidden className="font-mono text-xs tracking-wider">
                {squaresForPct(g.proximityPct)}
              </span>
              <span className="sr-only">
                {g.correct
                  ? "Correct"
                  : `${g.distanceKm} kilometers away, ${g.proximityPct}% close`}
              </span>
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
