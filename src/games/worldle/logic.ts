import { distanceKm, bearing, bearingArrow, proximityPct, type LonLat } from "../../lib/geo";

export interface WorldlePuzzle {
  code: string; // ISO 3166-1 alpha-2, e.g. "IN"
}

/**
 * A freshly-started play's `state` is briefly `{}` (see CLAUDE.md "The {} gotcha"). Always derive
 * state as `{ ...DEFAULT_STATE, ...play?.state }`, never `play?.state ?? DEFAULT_STATE`.
 */
export interface WorldleState {
  guesses: string[]; // ISO codes, in guess order
}

export const DEFAULT_STATE: WorldleState = { guesses: [] };

export const MAX_GUESSES = 6;

export interface CountryEntry {
  name: string;
  aliases: string[];
}

export type CountryNames = Record<string, CountryEntry>;
export type CountryCentroids = Record<string, LonLat>;

export interface GuessFeedback {
  code: string;
  correct: boolean;
  distanceKm: number;
  bearingDeg: number;
  arrow: string;
  proximityPct: number;
}

/** Scores one guess against the secret. `centroids` comes from the precomputed silhouettes file. */
export function evaluateGuess(
  code: string,
  secretCode: string,
  centroids: CountryCentroids,
): GuessFeedback {
  if (code === secretCode) {
    return { code, correct: true, distanceKm: 0, bearingDeg: 0, arrow: "", proximityPct: 100 };
  }
  const from = centroids[code];
  const to = centroids[secretCode];
  if (!from || !to) {
    throw new Error(`worldle: missing centroid for ${from ? secretCode : code}`);
  }
  const dist = distanceKm(from, to);
  const deg = bearing(from, to);
  return {
    code,
    correct: false,
    distanceKm: dist,
    bearingDeg: deg,
    arrow: bearingArrow(deg),
    proximityPct: proximityPct(dist),
  };
}

export function isWon(state: WorldleState, secretCode: string): boolean {
  return state.guesses.includes(secretCode);
}

export function isLost(state: WorldleState, secretCode: string): boolean {
  return !isWon(state, secretCode) && state.guesses.length >= MAX_GUESSES;
}

export function isOver(state: WorldleState, secretCode: string): boolean {
  return isWon(state, secretCode) || isLost(state, secretCode);
}

export interface CountrySuggestion {
  code: string;
  name: string;
}

/**
 * Autocomplete matcher: case-insensitive match against a country's canonical name or any alias.
 * Exact match ranks first, then prefix match, then substring match; already-guessed codes are
 * never suggested. This is the *only* way a guess is submitted (see RESEARCH.md "Autocomplete
 * with aliases") — there is no separate free-text parser, so a guess is always unambiguous.
 */
export function searchCountries(
  query: string,
  names: CountryNames,
  excludeCodes: readonly string[] = [],
  limit = 8,
): CountrySuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exclude = new Set(excludeCodes);

  const scored: { code: string; name: string; rank: number }[] = [];
  for (const [code, entry] of Object.entries(names)) {
    if (exclude.has(code)) continue;
    let rank: number | null = null;
    for (const candidate of [entry.name, ...entry.aliases]) {
      const lc = candidate.toLowerCase();
      if (lc === q) rank = 0;
      else if (lc.startsWith(q)) rank = Math.min(rank ?? 1, 1);
      else if (lc.includes(q)) rank = Math.min(rank ?? 2, 2);
    }
    if (rank !== null) scored.push({ code, name: entry.name, rank });
  }

  scored.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map(({ code, name }) => ({ code, name }));
}

/** Resolves a code's display name (falls back to the code itself if somehow not in the lookup). */
export function nameFor(code: string, names: CountryNames): string {
  return names[code]?.name ?? code;
}

const PROXIMITY_EMOJI: [min: number, emoji: string][] = [
  [90, "🟩"],
  [70, "🟨"],
  [40, "🟧"],
  [0, "⬛"],
];

function proximityEmoji(pct: number): string {
  return PROXIMITY_EMOJI.find(([min]) => pct >= min)![1];
}

/** Spoiler-free share text: coloured proximity squares + direction arrows, never the answer. */
export function buildSummary(
  state: WorldleState,
  secretCode: string,
  puzzleNumber: number,
  centroids: CountryCentroids,
): string {
  const won = isWon(state, secretCode);
  const rows = state.guesses.map((code) => {
    const fb = evaluateGuess(code, secretCode, centroids);
    return fb.correct ? proximityEmoji(100) : `${proximityEmoji(fb.proximityPct)}${fb.arrow}`;
  });
  return `Worldle #${puzzleNumber} ${won ? state.guesses.length : "X"}/${MAX_GUESSES}\n${rows.join("\n")}`;
}
