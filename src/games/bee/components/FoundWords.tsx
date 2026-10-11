import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { isPangram, scoreWord, type BeePuzzle } from "../logic";

export interface FoundWordsProps {
  found: string[];
  puzzle: BeePuzzle;
}

/** Alphabetical list of words found so far, each tagged with its score and pangram marker. */
export function FoundWords({ found, puzzle }: FoundWordsProps) {
  const reduceMotion = useReducedMotion();
  const sorted = [...found].sort();

  if (sorted.length === 0) {
    return <p className="text-center text-sm text-game-muted">No words found yet.</p>;
  }

  return (
    <div>
      <p className="mb-2 text-center text-xs text-game-muted">
        {found.length} word{found.length === 1 ? "" : "s"} found
      </p>
      <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Found words">
        <AnimatePresence initial={false}>
          {sorted.map((word) => {
            const pangram = isPangram(word, puzzle);
            return (
              <motion.li
                key={word}
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-1 rounded-brand-sm border px-2 py-1 text-sm font-semibold ${
                  pangram
                    ? "border-game-accent bg-game-accent/20 text-game-fg"
                    : "border-game-border bg-game-surface text-game-fg"
                }`}
              >
                {pangram && <span aria-hidden>🔆</span>}
                <span>{word}</span>
                <span className="text-xs text-game-muted">{scoreWord(word, puzzle)}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
