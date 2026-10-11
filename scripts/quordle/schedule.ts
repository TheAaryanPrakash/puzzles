// Pure day-by-day answer assignment, kept separate from file I/O so it's trivially testable.
import { mulberry32, shuffle } from "../../src/lib/daily";

export interface ScheduleOptions {
  /** mulberry32 seed — the whole pool is shuffled once with this, so the schedule is deterministic. */
  seed: number;
  /** Dates ("YYYY-MM-DD"), in the order they should be assigned. */
  days: string[];
  /** Deduped candidate answer words. Must have at least `days.length * boardsPerDay` entries. */
  pool: string[];
  /** date -> that day's excluded word (e.g. the Wordle answer), if any. */
  excludedByDate?: Map<string, string | undefined>;
  boardsPerDay?: number;
}

/**
 * Assigns `boardsPerDay` distinct words to each day by shuffling the whole pool once and walking a
 * single cursor forward through it. A candidate equal to that day's excluded word is skipped (left
 * for a later day) rather than reused, so the whole schedule never repeats an answer and stays
 * deterministic for a given seed + exclusion set.
 */
export function assignDailyAnswers({
  seed,
  days,
  pool,
  excludedByDate,
  boardsPerDay = 4,
}: ScheduleOptions): Map<string, string[]> {
  const needed = days.length * boardsPerDay;
  if (pool.length < needed) {
    throw new Error(
      `fair-answer pool too small: need at least ${needed} words for ${days.length} days x ${boardsPerDay} boards, have ${pool.length}`,
    );
  }

  const shuffled = shuffle(pool, mulberry32(seed));
  let cursor = 0;
  const result = new Map<string, string[]>();

  for (const date of days) {
    const excluded = excludedByDate?.get(date);
    const picked: string[] = [];
    while (picked.length < boardsPerDay) {
      if (cursor >= shuffled.length) {
        throw new Error(`ran out of fair-answer words while assigning ${date} (exclusions consumed the slack)`);
      }
      const candidate = shuffled[cursor++];
      if (candidate === excluded) continue;
      if (picked.includes(candidate)) continue;
      picked.push(candidate);
    }
    result.set(date, picked);
  }

  return result;
}
