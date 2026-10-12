import { proximityPct } from "../../lib/geo";

export interface GloblePuzzle {
  code: string; // ISO 3166-1 alpha-2 of today's secret country
}

export interface GlobleGuess {
  code: string;
  /** Border-to-border km from this guess to the secret, from the precomputed distance matrix. */
  km: number;
}

export interface GlobleState {
  guesses: GlobleGuess[];
}

/**
 * A freshly-started play's `state` is `{}` right after `start()` (see CLAUDE.md's "{} gotcha") —
 * always derive state as `{ ...DEFAULT_STATE, ...play?.state }`, never `play?.state ?? DEFAULT_STATE`.
 */
export const DEFAULT_STATE: GlobleState = { guesses: [] };

export function hasGuessed(state: GlobleState, code: string): boolean {
  return state.guesses.some((g) => g.code === code);
}

export function isWon(state: GlobleState, secretCode: string): boolean {
  return hasGuessed(state, secretCode);
}

/** Globle has no loss condition: unlimited guesses, the only end state is winning. */
export function isOver(state: GlobleState, secretCode: string): boolean {
  return isWon(state, secretCode);
}

export function appendGuess(state: GlobleState, guess: GlobleGuess): GlobleState {
  if (hasGuessed(state, guess.code)) return state;
  return { guesses: [...state.guesses, guess] };
}

/** 0–100, 100 = exact match or a land neighbour (both score 0 km). */
export function proximityForGuess(guess: GlobleGuess): number {
  return proximityPct(guess.km);
}

/** Guesses sorted closest-first (ties broken by guess order), for the "closest so far" list. */
export function closestSoFar(state: GlobleState): GlobleGuess[] {
  return state.guesses
    .map((g, i) => ({ g, i }))
    .sort((a, b) => a.g.km - b.g.km || a.i - b.i)
    .map(({ g }) => g);
}

/** Redesign (2026-10): the approved far/hot endpoints from the Checkpoint-1 heat scale
 * (docs/redesign/checkpoint-1/colors.png — far #3d2930, cool #993355, warm #dd3c71, hot #eb6347).
 * `proximityColor` only lerps between two endpoints, so this uses far/hot as those endpoints; the
 * eased `t` below already passes the gradient through cool/warm-ish territory on the way. Must
 * stay in sync with theme.css's `--globle-graticule` (far) / `--game-accent` (hot) — same portal/
 * canvas-needs-a-literal-value reason as Quordle's BOARD_COLORS, see that file's comment. */
const FAR_COLOR = { r: 0x3d, g: 0x29, b: 0x30 }; // #3d2930
const CLOSE_COLOR = { r: 0xeb, g: 0x63, b: 0x47 }; // #eb6347
/** Distinct from the warm scale so a correct guess doesn't read as merely "very close" — kept a
 * true mint-green (not nudged toward the red/gold scale) so it stays a different hue family under
 * protanopia/deuteranopia simulation too, not just a different lightness. Matches --brand-success. */
export const SOLVED_COLOR = "#4ebc85";
/** Country never guessed — a faint tint of the globe's own surface, not part of the warm scale.
 * Must stay in sync with theme.css's `--globle-unguessed`. */
export const UNGUESSED_COLOR = "#1c1215";

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Maps a 0–100 proximity to a warm color: pale gold (far) → deep red (close). Eased with
 * `t = (pct/100)^1.4` so the scale stays visibly pale/orange for most of its range and only
 * reads as deep red once a guess is genuinely close — matching the "far = pale, close = deep
 * red" brief without the whole globe turning pink after one guess.
 */
export function proximityColor(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const t = Math.pow(clamped / 100, 1.4);
  const r = lerp(FAR_COLOR.r, CLOSE_COLOR.r, t);
  const g = lerp(FAR_COLOR.g, CLOSE_COLOR.g, t);
  const b = lerp(FAR_COLOR.b, CLOSE_COLOR.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** The fill color for one guessed country (the solved color if it was the correct guess). */
export function colorForGuess(guess: GlobleGuess, secretCode: string): string {
  if (guess.code === secretCode) return SOLVED_COLOR;
  return proximityColor(proximityForGuess(guess));
}

/** Proximity bucketed into one of 4 emoji squares for the spoiler-free share grid. */
function bucketEmoji(pct: number, isCorrect: boolean): string {
  if (isCorrect) return "✅";
  if (pct >= 66) return "🟥";
  if (pct >= 33) return "🟧";
  return "⬜";
}

/**
 * Spoiler-free share text: puzzle number, guess count, and a row of bucketed-proximity squares —
 * never a country name or code, so it can never leak the secret even to the player who solved it.
 */
export function buildSummary(
  state: GlobleState,
  secretCode: string,
  puzzleNumber: number,
): string {
  const won = isWon(state, secretCode);
  const grid = state.guesses
    .map((g) => bucketEmoji(proximityForGuess(g), g.code === secretCode))
    .join("");
  const guessWord = state.guesses.length === 1 ? "guess" : "guesses";
  return `Globle #${puzzleNumber} ${won ? `${state.guesses.length} ${guessWord}` : "unsolved"}\n${grid}`;
}
