import { LAUNCH_DATE, PUZZLE_TIMEZONE } from "../config";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today's date ("YYYY-MM-DD") in PUZZLE_TIMEZONE — the same calendar day for every player,
 * everywhere, regardless of device time zone.
 *
 * In dev builds only, a `?date=YYYY-MM-DD` query param overrides this (used to test day
 * rollover without waiting for midnight). `import.meta.env.DEV` is false in production builds,
 * so the override can never reach production. Guarded with optional chaining because this file
 * is also imported by generator scripts run directly with `tsx` (no Vite, so `import.meta.env`
 * is undefined there, not just falsy).
 */
export function todayKey(): string {
  if (typeof window !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    const override = new URLSearchParams(window.location.search).get("date");
    if (override && DATE_RE.test(override)) return override;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PUZZLE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
  return `${map.year}-${map.month}-${map.day}`;
}

function parseDateKey(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function toUtcMs(date: string): number {
  const { y, m, d } = parseDateKey(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds (or subtracts, with a negative count) whole days to a "YYYY-MM-DD" date, in UTC. */
export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * 86_400_000);
}

/** Whole days between LAUNCH_DATE and `date` (0 on launch day, negative before it). */
export function dayIndex(date: string): number {
  return Math.round((toUtcMs(date) - toUtcMs(LAUNCH_DATE)) / 86_400_000);
}

/** Deterministic PRNG (Mulberry32): same seed always produces the same sequence of [0, 1) floats. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle, driven by `rng`. Returns a new array; does not mutate. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
