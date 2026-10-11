import { motion } from "motion/react";
import type { GeoFeedback } from "../logic";
import type { CountryOption } from "../useFlagleAssets";

export interface GuessRow {
  code: string;
  option: CountryOption | undefined;
  feedback: GeoFeedback | null;
}

export interface GuessHistoryProps {
  rows: GuessRow[];
}

function rowTone(feedback: GeoFeedback | null): string {
  if (!feedback) return "border-game-border bg-game-surface";
  if (feedback.correct) return "border-tile-correct bg-tile-correct/10";
  if (feedback.proximityPct >= 60) return "border-tile-present bg-tile-present/10";
  return "border-game-border bg-game-surface";
}

/** Past guesses, most recent last, each with its distance/direction/proximity geo feedback. */
export function GuessHistory({ rows }: GuessHistoryProps) {
  if (rows.length === 0) return null;

  return (
    <ul className="flex w-full flex-col gap-2" aria-label="Your guesses">
      {rows.map((row, i) => (
        <motion.li
          key={`${row.code}-${i}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`flex items-center gap-3 rounded-brand-sm border p-2 text-sm ${rowTone(row.feedback)}`}
        >
          <span
            aria-hidden
            className={`fi fi-${row.code.toLowerCase()}`}
            style={{ width: "1.6em", height: "1.2em", backgroundSize: "cover", flexShrink: 0 }}
          />
          <span className="min-w-0 flex-1 truncate font-medium text-game-fg">
            {row.option?.name ?? row.code}
          </span>
          {row.feedback?.correct ? (
            <span className="font-semibold text-tile-correct">Correct! 🎯</span>
          ) : row.feedback ? (
            <span className="flex items-center gap-2 text-game-muted">
              <span>{row.feedback.distanceKm.toLocaleString()} km</span>
              <span aria-hidden>{row.feedback.arrow}</span>
              <span>{row.feedback.proximityPct}%</span>
            </span>
          ) : null}
        </motion.li>
      ))}
    </ul>
  );
}
