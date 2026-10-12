import { LAUNCH_DATE } from "../config";
import { addDays, todayKey, dayIndex } from "../lib/daily";
import GlideSelect, { type GlideSelectOption } from "./fx/GlideSelect";
import type { ArchivePickerProps } from "./types";

// No visible heading here — ArchivePicker is always shown inside a titled Modal (GameLayout's
// Archive button), so a second "Archive" heading would just be noise. `title` still labels the
// section for assistive tech.
//
// Redesign (2026-10): a GlideSelect dropdown of puzzle numbers, replacing the old day-number
// grid. Flagged for the human: this list only grows (every day since LAUNCH_DATE), and GlideSelect
// has no filtering/virtualization — fine today (LAUNCH_DATE is today, so the list is empty in
// practice) and fine for a while, but a GlideCombobox (type-to-search, phase-2 component) or
// grouping by month would scale better once there are a few hundred days of archive.
export function ArchivePicker({ gameId, playedDates, onSelect, title = "Archive" }: ArchivePickerProps) {
  const dates: string[] = [];
  for (let d = addDays(todayKey(), -1); d >= LAUNCH_DATE; d = addDays(d, -1)) {
    dates.push(d);
  }
  const playedSet = new Set(playedDates);
  // Played dates stay in the list, tagged, rather than disappearing — selecting one still
  // navigates there and shows its read-only finished result (CLAUDE.md's game contract: a
  // finished play always renders read-only, there's no reason to hide it from the archive).
  const options: GlideSelectOption[] = dates.map((date) => ({
    value: date,
    label: `#${dayIndex(date) + 1}`,
    tag: playedSet.has(date) ? "played" : undefined,
  }));

  return (
    <section aria-label={`${title} for ${gameId}`}>
      {dates.length === 0 ? (
        <p className="text-center text-sm text-game-muted">No past puzzles yet. Check back tomorrow.</p>
      ) : (
        <div className="flex justify-center py-1">
          <GlideSelect
            options={options}
            onChange={(date) => onSelect(date)}
            placeholder="Pick a past puzzle…"
            ariaLabel={`${title} for ${gameId}`}
            accentColor="var(--brand-accent)"
            surfaceColor="var(--game-surface-2)"
            highlightColor="var(--brand-accent)"
            textColor="var(--game-fg)"
            menuWidth={220}
          />
        </div>
      )}
    </section>
  );
}
