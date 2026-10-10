import { motion, useReducedMotion } from "motion/react";
import { RANKS, rankThreshold, type BeePuzzle } from "../logic";

export interface RankBarProps {
  score: number;
  puzzle: BeePuzzle;
  rankIndex: number;
}

/** Segmented progress bar across the rank ladder, with the current rank highlighted. */
export function RankBar({ score, puzzle, rankIndex }: RankBarProps) {
  const reduceMotion = useReducedMotion();
  const pct = Math.min(100, (score / puzzle.maxScore) * 100);
  const rank = RANKS[rankIndex];
  const next = RANKS[rankIndex + 1];
  const pointsToNext = next ? Math.max(0, rankThreshold(next, puzzle) - score) : null;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-brand text-sm font-bold text-game-fg">{rank.name}</span>
        <span className="text-xs text-game-muted">{score} pts</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={puzzle.maxScore}
        aria-label="Rank progress"
        className="relative flex h-2.5 w-full overflow-hidden rounded-brand-full bg-game-surface-2"
      >
        {RANKS.slice(1).map((r) => (
          <span
            key={r.name}
            aria-hidden
            className="absolute top-0 h-full w-px bg-game-border"
            style={{ left: `${r.pct * 100}%` }}
          />
        ))}
        <motion.div
          className="h-full rounded-brand-full bg-game-accent"
          initial={reduceMotion ? undefined : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1 text-xs text-game-muted">
        {pointsToNext !== null
          ? `${pointsToNext} point${pointsToNext === 1 ? "" : "s"} to ${next!.name}`
          : "Queen Bee — every word found!"}
      </p>
    </div>
  );
}
