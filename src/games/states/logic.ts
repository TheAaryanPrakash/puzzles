import { bearing, bearingArrow, distanceKm, proximityPct, type LonLat } from "../../lib/geo";

export interface StatePuzzle {
  code: string;
}

/**
 * A freshly-started play's `state` is briefly `{}` (see CLAUDE.md's "`{}` gotcha" and
 * `_example/logic.ts`'s DEFAULT_STATE comment) — always derive with
 * `{ ...DEFAULT_STATE, ...play?.state }`, never `play?.state ?? DEFAULT_STATE`.
 */
export interface StateState {
  guesses: string[]; // state/UT codes, in guess order
}

export const DEFAULT_STATE: StateState = { guesses: [] };

export const MAX_GUESSES = 6;

export interface StateInfo {
  name: string;
  centroid: LonLat;
}

export type StatesIndex = Record<string, StateInfo>;

/** Lowercase, `&`→`and`, strip punctuation, collapse whitespace — so "Jammu & Kashmir", "jammu and
 *  kashmir" and "Jammu   and Kashmir." all normalize identically. */
export function normalizeStateName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Former names, common short forms and split/merged-UT history a friend might type instead of the
 * current official name. See RESEARCH.md §4 for the reasoning and what's deliberately left out
 * (ambiguous "Bombay", confusable "UK", and historical names obscure enough to risk a false match).
 * Keys are already normalized (lowercase, "and" not "&").
 */
export const STATE_ALIASES: Record<string, string> = {
  orissa: "IN-OD",
  mysore: "IN-KA",
  madras: "IN-TN",
  pondicherry: "IN-PY",
  pondy: "IN-PY",
  uttaranchal: "IN-UK",
  "nct of delhi": "IN-DL",
  "national capital territory of delhi": "IN-DL",
  "new delhi": "IN-DL",
  "andaman and nicobar islands": "IN-AN",
  "daman and diu": "IN-DH",
  "dadra and nagar haveli": "IN-DH",
  chattisgarh: "IN-CG",
  up: "IN-UP",
  mp: "IN-MP",
  ap: "IN-AP",
  tn: "IN-TN",
  wb: "IN-WB",
  hp: "IN-HP",
  mh: "IN-MH",
  ka: "IN-KA",
  gj: "IN-GJ",
  rj: "IN-RJ",
  pb: "IN-PB",
  hr: "IN-HR",
  kl: "IN-KL",
  tg: "IN-TS",
};

/** Every normalized name/alias that currently resolves to a code — canonical names first, so an
 *  alias can never shadow a real state's own official name. */
export function buildNameIndex(states: StatesIndex): Map<string, string> {
  const index = new Map<string, string>();
  for (const [code, info] of Object.entries(states)) {
    index.set(normalizeStateName(info.name), code);
  }
  for (const [alias, code] of Object.entries(STATE_ALIASES)) {
    const key = normalizeStateName(alias);
    if (!index.has(key)) index.set(key, code);
  }
  return index;
}

/** Resolves free-typed text to a state code via `nameIndex`, or `null` if nothing matches —
 *  callers must not consume a guess on `null`. */
export function resolveGuess(input: string, nameIndex: Map<string, string>): string | null {
  return nameIndex.get(normalizeStateName(input)) ?? null;
}

export function alreadyGuessed(state: StateState, code: string): boolean {
  return state.guesses.includes(code);
}

export interface GuessResult {
  code: string;
  name: string;
  correct: boolean;
  distanceKm: number;
  bearingDeg: number;
  arrow: string;
  proximityPct: number;
}

/** Distance/direction/proximity feedback for one guess, scaled to `maxDistanceKm` — pass India's
 *  own max centroid-to-centroid distance (from silhouettes.json), not Earth's antipodal one. */
export function feedbackForGuess(
  code: string,
  answerCode: string,
  states: StatesIndex,
  maxDistanceKm: number,
): GuessResult {
  const guess = states[code];
  const answer = states[answerCode];
  const correct = code === answerCode;
  const d = correct ? 0 : distanceKm(guess.centroid, answer.centroid);
  const brg = correct ? 0 : bearing(guess.centroid, answer.centroid);
  return {
    code,
    name: guess.name,
    correct,
    distanceKm: Math.round(d),
    bearingDeg: brg,
    arrow: correct ? "🎯" : bearingArrow(brg),
    proximityPct: correct ? 100 : proximityPct(d, maxDistanceKm),
  };
}

export function isWon(state: StateState, answerCode: string): boolean {
  return state.guesses.includes(answerCode);
}

export function isLost(state: StateState, answerCode: string): boolean {
  return !isWon(state, answerCode) && state.guesses.length >= MAX_GUESSES;
}

export function isOver(state: StateState, answerCode: string): boolean {
  return isWon(state, answerCode) || isLost(state, answerCode);
}

/** Worldle's own rounding rule (confirmed against its FAQ's worked example: 72% → 🟩🟩🟩🟨⬛):
 *  round the percent down to the nearest 10, 1 green square per 20, 1 yellow for a remaining 10. */
export function squaresForPct(pct: number): string {
  const rounded = Math.floor(pct / 10) * 10;
  const green = Math.floor(rounded / 20);
  const yellow = rounded % 20 === 10 ? 1 : 0;
  const black = 5 - green - yellow;
  return "🟩".repeat(green) + "🟨".repeat(yellow) + "⬛".repeat(black);
}

/** Spoiler-free share text: puzzle number, result, and one row of proximity squares per guess —
 *  never a state's name or code. */
export function buildSummary(
  state: StateState,
  answerCode: string,
  states: StatesIndex,
  maxDistanceKm: number,
  puzzleNumber: number,
): string {
  const won = isWon(state, answerCode);
  const rows = state.guesses.map((code) =>
    squaresForPct(feedbackForGuess(code, answerCode, states, maxDistanceKm).proximityPct),
  );
  const result = won ? state.guesses.length : "X";
  return `States #${puzzleNumber} ${result}/${MAX_GUESSES}\n${rows.join("\n")}`;
}
