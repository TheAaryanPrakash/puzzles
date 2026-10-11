import { LAUNCH_DATE } from "../config";
import { addDays, todayKey, dayIndex } from "../lib/daily";
import type { ArchivePickerProps } from "./types";

// No visible heading here — ArchivePicker is always shown inside a titled Modal (GameLayout's
// Archive button), so a second "Archive" heading would just be noise. `title` still labels the
// section for assistive tech.
export function ArchivePicker({ gameId, playedDates, onSelect, title = "Archive" }: ArchivePickerProps) {
  const dates: string[] = [];
  for (let d = addDays(todayKey(), -1); d >= LAUNCH_DATE; d = addDays(d, -1)) {
    dates.push(d);
  }
  const playedSet = new Set(playedDates);

  return (
    <section aria-label={`${title} for ${gameId}`}>
      {dates.length === 0 ? (
        <p className="text-center text-sm text-game-muted">No past puzzles yet. Check back tomorrow.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {dates.map((date) => {
            const played = playedSet.has(date);
            return (
              <li key={date}>
                <button
                  type="button"
                  disabled={played}
                  onClick={() => onSelect(date)}
                  className={`flex h-11 w-full items-center justify-center rounded-brand-sm border text-xs font-semibold transition-colors duration-brand-fast ${
                    played
                      ? "border-game-border bg-game-surface-2 text-game-muted"
                      : "border-game-border bg-game-surface text-game-fg hover:border-game-accent hover:text-game-accent"
                  }`}
                >
                  {played ? "✓" : `#${dayIndex(date) + 1}`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
