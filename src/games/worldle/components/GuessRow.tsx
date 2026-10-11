import { motion, useReducedMotion } from "motion/react";
import type { GuessFeedback } from "../logic";

interface GuessRowProps {
  feedback: GuessFeedback;
  name: string;
  index: number;
}

function proximityClass(pct: number): string {
  if (pct >= 90) return "worldle-proximity-high";
  if (pct >= 70) return "worldle-proximity-mid";
  if (pct >= 40) return "worldle-proximity-low";
  return "worldle-proximity-cold";
}

export function GuessRow({ feedback, name, index }: GuessRowProps) {
  const reducedMotion = useReducedMotion();
  const { code, correct, distanceKm, arrow, proximityPct } = feedback;

  return (
    <motion.li
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: reducedMotion ? 0 : index * 0.03 }}
      className="grid grid-cols-[auto_1fr_auto_auto_3rem] items-center gap-3 rounded-brand-sm border border-game-border bg-game-surface p-2.5"
    >
      <span className={`fi fi-${code.toLowerCase()}`} aria-hidden="true" />
      <span className="truncate font-medium">{name}</span>
      {correct ? (
        <span className="col-span-3 text-right font-semibold text-game-accent">Correct!</span>
      ) : (
        <>
          <span className="whitespace-nowrap text-sm text-game-muted">
            {Math.round(distanceKm).toLocaleString()} km
          </span>
          <motion.span
            aria-hidden="true"
            initial={reducedMotion ? false : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.25, delay: reducedMotion ? 0 : index * 0.03 + 0.1 }}
            className="text-lg"
          >
            {arrow}
          </motion.span>
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-brand-sm text-xs font-semibold text-white ${proximityClass(proximityPct)}`}
          >
            {proximityPct}%
          </span>
        </>
      )}
    </motion.li>
  );
}
