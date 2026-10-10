// Deterministic day → country assignment. No I/O — see generate.ts.
import { mulberry32, shuffle } from "../../src/lib/daily";

/**
 * Assigns one code per day for `numDays` days, cycling through a seeded shuffle of `codes` with
 * no repeats until the whole pool has been used, then reshuffling (same `rng`, so still fully
 * deterministic for a given seed) for the next cycle. If `numDays` isn't a multiple of the pool
 * size, the tail cycle is simply truncated.
 */
export function assignDays(codes: readonly string[], numDays: number, seed: number): string[] {
  if (codes.length === 0) throw new Error("assignDays: empty pool");
  const rng = mulberry32(seed);
  const result: string[] = [];
  while (result.length < numDays) {
    result.push(...shuffle(codes, rng));
  }
  return result.slice(0, numDays);
}
