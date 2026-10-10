export interface BeePuzzle {
  center: string;
  outer: string[];
  answers: string[];
  pangrams: string[];
  maxScore: number;
}

export interface BeeState {
  found: string[];
}

/**
 * A freshly-started play's `state` is `{}` right after `start()` resolves, before the first
 * `save()` lands (the database's `default '{}'::jsonb`, mirrored by the local adapter — every
 * game hits this). Always derive state as `{ ...DEFAULT_STATE, ...play?.state }`, never
 * `play?.state ?? DEFAULT_STATE`.
 */
export const DEFAULT_STATE: BeeState = { found: [] };

export const MIN_WORD_LENGTH = 4;

export interface Rank {
  name: string;
  /** Fraction of maxScore required to reach this rank (0–1). */
  pct: number;
}

/** The ladder, low to high. Queen Bee requires finding every answer, not just 100% of points
 *  (the two coincide in practice, since every answer's points sum to maxScore by definition). */
export const RANKS: Rank[] = [
  { name: "Beginner", pct: 0 },
  { name: "Good Start", pct: 0.02 },
  { name: "Moving Up", pct: 0.05 },
  { name: "Good", pct: 0.08 },
  { name: "Solid", pct: 0.15 },
  { name: "Nice", pct: 0.25 },
  { name: "Great", pct: 0.4 },
  { name: "Amazing", pct: 0.5 },
  { name: "Genius", pct: 0.7 },
  { name: "Queen Bee", pct: 1 },
];

export const GENIUS_INDEX = RANKS.findIndex((r) => r.name === "Genius");

/** 26-bit mask, one bit per distinct letter (bit 0 = A … bit 25 = Z). */
export function letterMask(word: string): number {
  let mask = 0;
  for (const ch of word.toUpperCase()) {
    const bit = ch.charCodeAt(0) - 65;
    if (bit >= 0 && bit < 26) mask |= 1 << bit;
  }
  return mask;
}

export function puzzleMask(puzzle: BeePuzzle): number {
  return letterMask(puzzle.center + puzzle.outer.join(""));
}

export function isPangram(word: string, puzzle: BeePuzzle): boolean {
  return letterMask(word) === puzzleMask(puzzle);
}

/** 1 point for a 4-letter word, otherwise 1 point per letter, +7 if it's a pangram. */
export function scoreWord(word: string, puzzle: BeePuzzle): number {
  const base = word.length === MIN_WORD_LENGTH ? 1 : word.length;
  return base + (isPangram(word, puzzle) ? 7 : 0);
}

export function totalScore(found: readonly string[], puzzle: BeePuzzle): number {
  return found.reduce((sum, w) => sum + scoreWord(w, puzzle), 0);
}

/** Strips anything that isn't A-Z and upper-cases, so typed/tapped input always compares cleanly. */
export function normalizeWord(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, "");
}

export type InvalidReason =
  | "too-short"
  | "invalid-letter"
  | "missing-center"
  | "not-in-word-list"
  | "already-found";

export type ValidationResult =
  | { ok: true; word: string }
  | { ok: false; reason: InvalidReason };

/** Pure validation — checked in the same order the hive UI should report feedback for. */
export function validateWord(
  input: string,
  puzzle: BeePuzzle,
  found: readonly string[],
): ValidationResult {
  const word = normalizeWord(input);
  if (word.length < MIN_WORD_LENGTH) return { ok: false, reason: "too-short" };

  const mask = puzzleMask(puzzle);
  const wordMask = letterMask(word);
  if ((wordMask & ~mask) !== 0) return { ok: false, reason: "invalid-letter" };

  const centerBit = 1 << (puzzle.center.charCodeAt(0) - 65);
  if ((wordMask & centerBit) === 0) return { ok: false, reason: "missing-center" };

  if (!puzzle.answers.includes(word)) return { ok: false, reason: "not-in-word-list" };
  if (found.includes(word)) return { ok: false, reason: "already-found" };

  return { ok: true, word };
}

export function isQueenBee(found: readonly string[], puzzle: BeePuzzle): boolean {
  return found.length >= puzzle.answers.length;
}

export function rankThreshold(rank: Rank, puzzle: BeePuzzle): number {
  return Math.ceil(puzzle.maxScore * rank.pct);
}

export interface RankStatus {
  index: number;
  rank: Rank;
  score: number;
  /** Points needed to reach the next rank; null when already at the top (Queen Bee). */
  pointsToNext: number | null;
}

export function rankFor(score: number, puzzle: BeePuzzle): RankStatus {
  let index = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (score >= rankThreshold(RANKS[i], puzzle)) {
      index = i;
      break;
    }
  }
  const next = RANKS[index + 1];
  return {
    index,
    rank: RANKS[index],
    score,
    pointsToNext: next ? Math.max(0, rankThreshold(next, puzzle) - score) : null,
  };
}

/** "Won" per the task contract: reached Genius (or above) by the time the play is finished. */
export function reachedGenius(score: number, puzzle: BeePuzzle): boolean {
  return score >= rankThreshold(RANKS[GENIUS_INDEX], puzzle);
}

/**
 * Spoiler-free share text: rank, score and word/pangram counts — never which words were found,
 * since the answer pool itself is what a friend shouldn't be able to infer from this.
 */
export function buildSummary(
  found: readonly string[],
  puzzle: BeePuzzle,
  puzzleNumber: number,
): string {
  const score = totalScore(found, puzzle);
  const { rank } = rankFor(score, puzzle);
  const pangramCount = found.filter((w) => isPangram(w, puzzle)).length;
  const pangramNote = pangramCount > 0 ? ` (${pangramCount} pangram${pangramCount > 1 ? "s" : ""})` : "";
  const badge = isQueenBee(found, puzzle) ? "👑" : "🐝";
  return (
    `Spelling Bee #${puzzleNumber}\n` +
    `${badge} ${rank.name} — ${score}/${puzzle.maxScore} points, ${found.length}/${puzzle.answers.length} words${pangramNote}`
  );
}
