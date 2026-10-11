import { shuffle } from "../../src/lib/daily";

/**
 * `count` codes drawn from `codes`, reshuffled (seeded, deterministic) every time the pool is
 * exhausted — so no code repeats within any 36-day window, though the last code of one cycle and
 * the first of the next may coincide (CLAUDE.md's "no repeats until used up" is about one cycle,
 * not across the boundary).
 */
export function buildScheduleCodes(codes: readonly string[], rng: () => number, count: number): string[] {
  const schedule: string[] = [];
  let pool: string[] = [];
  while (schedule.length < count) {
    if (pool.length === 0) pool = shuffle(codes, rng);
    schedule.push(pool.shift()!);
  }
  return schedule;
}
