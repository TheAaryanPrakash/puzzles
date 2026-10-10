import { mulberry32, shuffle } from "../../lib/daily";
import { bearing, bearingArrow, distanceKm, proximityPct, type LonLat } from "../../lib/geo";

export interface FlaglePuzzle {
  /** ISO 3166-1 alpha-2 code of the day's country, e.g. "IN". */
  code: string;
}

export interface FlagleState {
  /** ISO codes guessed so far, in order, uppercase. */
  guesses: string[];
}

/**
 * A freshly-started play's `state` is `{}` (the database's `default '{}'::jsonb`, mirrored by the
 * local adapter) — not yet shaped like FlagleState. Always derive state as
 * `{ ...DEFAULT_STATE, ...play?.state }` rather than `play?.state ?? DEFAULT_STATE`: the latter
 * only falls back when `play` itself is null/undefined, so it still crashes on the empty-but-truthy
 * `{}` a game sees in the render right after `start()` resolves and before its first `save()` lands.
 */
export const DEFAULT_STATE: FlagleState = { guesses: [] };

export const MAX_GUESSES = 6;
export const GRID_ROWS = 2;
export const GRID_COLS = 3;
export const TOTAL_TILES = GRID_ROWS * GRID_COLS;

export function isWon(state: FlagleState, code: string): boolean {
  return state.guesses.includes(code);
}

export function isLost(state: FlagleState, code: string): boolean {
  return !isWon(state, code) && state.guesses.length >= MAX_GUESSES;
}

export function isOver(state: FlagleState, code: string): boolean {
  return isWon(state, code) || isLost(state, code);
}

export function alreadyGuessed(state: FlagleState, code: string): boolean {
  return state.guesses.includes(code);
}

/** Simple djb2-style string hash — deterministic, no crypto needed for a seed. */
function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return h >>> 0;
}

/**
 * Deterministic per-day order (a permutation of [0, TOTAL_TILES)) in which the tiles covering the
 * flag are lifted. Derived purely from `date`, so the day file stays `{ code }` — same order for
 * every player on a given puzzle date, no extra puzzle-file surface area.
 */
export function revealOrder(date: string): number[] {
  const rng = mulberry32(hashString(`flagle:${date}`));
  return shuffle(
    Array.from({ length: TOTAL_TILES }, (_, i) => i),
    rng,
  );
}

/**
 * Grid indices (0..TOTAL_TILES-1) still covering the flag. One tile lifts per guess made (in
 * practice always a wrong one, since a correct guess ends the game immediately), capped at
 * TOTAL_TILES - 1: the last tile never auto-lifts from a guess alone, so the final (6th) guess is
 * always made with the flag still partly covered. The game's own end state (won/lost) is what
 * fully reveals the flag, via ResultModal — not this function.
 */
export function hiddenTiles(state: FlagleState, date: string): number[] {
  const revealed = Math.min(state.guesses.length, TOTAL_TILES - 1);
  return revealOrder(date).slice(revealed);
}

export interface GeoFeedback {
  correct: boolean;
  distanceKm: number;
  bearingDeg: number;
  arrow: string;
  proximityPct: number;
}

/**
 * Distance/direction/closeness feedback for one guess against the target, using the shared
 * `lib/geo.ts` formulas (the same ones Worldle uses) so the mental model carries over between
 * games. Returns `null` if either code has no known centroid (defensive — every pool country has
 * one by construction, but a stray/typo'd code should never crash the page).
 */
export function feedbackFor(
  guessCode: string,
  targetCode: string,
  centroids: Record<string, LonLat>,
): GeoFeedback | null {
  const guess = centroids[guessCode];
  const target = centroids[targetCode];
  if (!guess || !target) return null;

  if (guessCode === targetCode) {
    return { correct: true, distanceKm: 0, bearingDeg: 0, arrow: "🎯", proximityPct: 100 };
  }

  const d = distanceKm(guess, target);
  const b = bearing(guess, target);
  return {
    correct: false,
    distanceKm: Math.round(d),
    bearingDeg: b,
    arrow: bearingArrow(b),
    proximityPct: proximityPct(d),
  };
}

/** Spoiler-free share text: a right/wrong emoji grid, never the target's code or name. */
export function buildSummary(state: FlagleState, targetCode: string, puzzleNumber: number): string {
  const won = isWon(state, targetCode);
  const grid = state.guesses.map((g) => (g === targetCode ? "🟩" : "🟥")).join("");
  return `Flagle #${puzzleNumber} ${won ? state.guesses.length : "X"}/${MAX_GUESSES}\n${grid}`;
}
