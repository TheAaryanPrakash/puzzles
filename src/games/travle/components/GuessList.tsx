import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { GuessCategory } from "../logic";
import type { CountryNames } from "../useCountryGeo";

export interface GuessListProps {
  guesses: string[];
  categories: Record<string, GuessCategory>;
  countryNames: CountryNames;
}

const CATEGORY_LABEL: Record<GuessCategory, string> = {
  "on-path": "On the route",
  adjacent: "Connects to another guess",
  unconnected: "Not connected yet",
};

const CATEGORY_COLOR: Record<GuessCategory, string> = {
  "on-path": "var(--tile-correct)",
  adjacent: "var(--tile-present)",
  unconnected: "var(--tile-absent)",
};

/** The guesses so far, newest first, each with its on-path/adjacent/unconnected category spelled
 *  out in text — this (not the decorative Map) is what a screen reader announces. */
export function GuessList({ guesses, categories, countryNames }: GuessListProps) {
  const shouldReduceMotion = useReducedMotion();

  if (guesses.length === 0) {
    return <p className="text-sm text-game-muted">No guesses yet — name a country below.</p>;
  }

  return (
    <ol className="flex flex-col gap-2" aria-label="Your guesses">
      <AnimatePresence initial={false}>
        {[...guesses].reverse().map((code) => {
          const category = categories[code];
          return (
            <motion.li
              key={code}
              layout
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-brand-sm border border-game-border bg-game-surface px-3 py-2"
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-brand-full"
                style={{ background: CATEGORY_COLOR[category] }}
              />
              <span className="flex-1 font-medium">{countryNames[code]?.name ?? code}</span>
              <span className="text-xs text-game-muted">{CATEGORY_LABEL[category]}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
