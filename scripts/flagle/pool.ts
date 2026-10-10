// Pure, testable pieces of the Flagle generator — kept separate from generate.ts's file I/O so
// Vitest can exercise them without touching the filesystem.
import { mulberry32, shuffle } from "../../src/lib/daily";

/**
 * Codes with no permanent civilian population — reviewing the first generator run's own sample
 * file turned up "French Southern and Antarctic Lands" (TF) as one of 5 random days, which isn't
 * a fair or fun flag for a friend-group daily game. Same reasoning as the sibling `worldle`
 * generator's prompt ("excluding very small territories"), applied here to the handful of entries
 * in `country-names.json` that are scientific-station-only or otherwise uninhabited:
 *   AQ Antarctica, GS South Georgia & the South Sandwich Islands,
 *   HM Heard Island & McDonald Islands, IO British Indian Ocean Territory,
 *   TF French Southern and Antarctic Lands.
 * Everything else — including small but *inhabited* places like Niue, Pitcairn or Vatican City —
 * stays in the pool; population size alone isn't disqualifying, lack of any resident population is.
 */
export const EXCLUDED_UNINHABITED = new Set(["AQ", "GS", "HM", "IO", "TF"]);

export function excludeUninhabited(pool: readonly string[]): string[] {
  return pool.filter((code) => !EXCLUDED_UNINHABITED.has(code));
}

/**
 * Builds the full, deterministic day-by-day country schedule for `days` days.
 *
 * The pool (one entry per playable country) is shuffled with `mulberry32(seed)` and used in
 * order; CLAUDE.md's "no repeats" and "throw if there aren't enough valid puzzles" rules conflict
 * once `days` exceeds the pool size (236 countries vs. 365 scheduled days — see RESEARCH.md), so
 * this reconciles them the same way the sibling `worldle` generator's prompt spells out
 * explicitly: no repeats *within* a shuffle of the whole pool, and once a shuffle is exhausted,
 * reshuffle (with a seed that still only depends on the base `seed` and which cycle it is, so the
 * whole schedule stays deterministic) and continue — swapping the new cycle's first country if it
 * would otherwise repeat the just-used last one, so no two *consecutive* days ever repeat even
 * across a cycle boundary.
 */
export function scheduleCountries(pool: readonly string[], seed: number, days: number): string[] {
  if (pool.length === 0) throw new Error("flagle: country pool is empty");

  const schedule: string[] = [];
  let cycle = 0;
  let lastCountry: string | null = null;

  while (schedule.length < days) {
    const rng = mulberry32(seed + cycle);
    const shuffled = shuffle(pool, rng);

    if (lastCountry !== null && shuffled[0] === lastCountry && shuffled.length > 1) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }

    for (const country of shuffled) {
      if (schedule.length >= days) break;
      schedule.push(country);
    }

    lastCountry = schedule[schedule.length - 1];
    cycle++;
  }

  return schedule;
}
