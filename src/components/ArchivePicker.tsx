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
      <ul className="grid grid-cols-4 gap-2">
        {dates.map((date) => {
          const played = playedSet.has(date);
          return (
            <li key={date}>
              <button
                type="button"
                disabled={played}
                onClick={() => onSelect(date)}
                className="w-full rounded-brand-sm border border-game-border bg-game-surface px-2 py-1 text-xs disabled:opacity-40"
              >
                #{dayIndex(date) + 1}
                {played && " ✓"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
