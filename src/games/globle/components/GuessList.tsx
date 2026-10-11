import { AnimatePresence, motion } from "motion/react";
import { colorForGuess, proximityForGuess, type GlobleGuess } from "../logic";
import type { CountryNameEntry } from "../worldData";

export interface GuessListProps {
  /** Closest-first (see `closestSoFar`). */
  guesses: GlobleGuess[];
  names: Record<string, CountryNameEntry>;
  secretCode: string;
}

/** The closest-so-far list: every guess, nearest first, with its distance, % and swatch. */
export function GuessList({ guesses, names, secretCode }: GuessListProps) {
  if (guesses.length === 0) {
    return <p className="text-sm text-game-muted">Your guesses will show up here, closest first.</p>;
  }

  return (
    <ul className="flex w-full max-w-sm flex-col gap-1.5" aria-label="Closest guesses so far">
      <AnimatePresence initial={false}>
        {guesses.map((guess, i) => {
          const correct = guess.code === secretCode;
          const pct = proximityForGuess(guess);
          return (
            <motion.li
              key={guess.code}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-brand-sm border border-game-border bg-game-surface px-3 py-2"
            >
              <span
                aria-hidden
                className="h-5 w-5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: colorForGuess(guess, secretCode) }}
              />
              <span className="flex-1 truncate font-brand text-sm">
                {i === 0 && "🏆 "}
                {names[guess.code]?.name ?? guess.code}
              </span>
              <span className="text-xs text-game-muted">
                {correct ? "You got it!" : `${guess.km.toLocaleString()} km`}
              </span>
              <span className="w-10 text-right text-xs font-semibold text-game-fg">{pct}%</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
