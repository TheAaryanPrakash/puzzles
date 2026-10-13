import { mulberry32, shuffle } from "../../lib/daily";
import { SITE_URL } from "../../config";

export interface ConnectionsGroup {
  label: string;
  level: 0 | 1 | 2 | 3;
  words: string[];
}

export interface ConnectionsPuzzle {
  groups: ConnectionsGroup[];
}

export interface ConnectionsState {
  guesses: string[][];
  order: string[];
}

/**
 * See the CLAUDE.md "{}" gotcha: right after `start()`, `play.state` is briefly `{}` — merge this
 * in (`{ ...DEFAULT_STATE, ...play?.state }`), never `play?.state ?? DEFAULT_STATE`.
 */
export const DEFAULT_STATE: ConnectionsState = { guesses: [], order: [] };

export const MAX_MISTAKES = 4;
export const GROUP_SIZE = 4;

export type GuessOutcome = "correct" | "one-away" | "incorrect" | "duplicate";

export function allWords(puzzle: ConnectionsPuzzle): string[] {
  return puzzle.groups.flatMap((g) => g.words);
}

function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return h >>> 0;
}

/**
 * The initial grid arrangement, deterministic per puzzle day so every member sees the same
 * layout (CLAUDE.md: "every member gets the same puzzle"). Only an explicit Shuffle click should
 * change the order after that — see `shuffleRemaining`, which is driven by `Math.random` since
 * it's a private per-player UI convenience, not puzzle content (CLAUDE.md's "never Math.random()
 * in scripts" governs generators, not live client interaction).
 */
export function initialOrder(puzzle: ConnectionsPuzzle, date: string): string[] {
  const rng = mulberry32(hashString(date));
  return shuffle(allWords(puzzle), rng);
}

/** The order actually used for rendering: the saved order once it's a full set, else the puzzle's
 *  deterministic initial order — covers both a fresh game and the `{}` window right after start(). */
export function effectiveOrder(state: ConnectionsState, puzzle: ConnectionsPuzzle, date: string): string[] {
  const words = allWords(puzzle);
  if (state.order.length === words.length && words.every((w) => state.order.includes(w))) {
    return state.order;
  }
  return initialOrder(puzzle, date);
}

/** Reshuffles only the words not yet solved, keeping solved slots (irrelevant — never rendered)
 *  and the relative arrangement otherwise untouched. */
export function shuffleRemaining(
  order: string[],
  solved: ReadonlySet<string>,
  rng: () => number,
): string[] {
  const unsolvedIndices: number[] = [];
  const unsolvedWords: string[] = [];
  order.forEach((w, i) => {
    if (!solved.has(w)) {
      unsolvedIndices.push(i);
      unsolvedWords.push(w);
    }
  });
  const reshuffled = shuffle(unsolvedWords, rng);
  const next = [...order];
  unsolvedIndices.forEach((idx, k) => {
    next[idx] = reshuffled[k];
  });
  return next;
}

/** Correct if all 4 words are one group; one-away if exactly 3 of 4 share a group; else incorrect.
 *  Does not check for an exact repeat of an earlier guess — see `isDuplicateGuess`. */
export function evaluateGuess(guess: readonly string[], puzzle: ConnectionsPuzzle): GuessOutcome {
  const counts = puzzle.groups.map((g) => guess.filter((w) => g.words.includes(w)).length);
  if (counts.includes(4)) return "correct";
  if (counts.includes(3)) return "one-away";
  return "incorrect";
}

function sortedKey(words: readonly string[]): string {
  return [...words].sort().join("|");
}

/** True if `guess` (as a set, any order) exactly matches an earlier submitted guess. */
export function isDuplicateGuess(guess: readonly string[], guesses: readonly string[][]): boolean {
  const key = sortedKey(guess);
  return guesses.some((g) => sortedKey(g) === key);
}

/** The group a correct guess matched, chronologically, deduped (a group can only be solved once —
 *  its words leave the grid immediately after). */
export function solvedGroups(guesses: readonly string[][], puzzle: ConnectionsPuzzle): ConnectionsGroup[] {
  const solved: ConnectionsGroup[] = [];
  const solvedLabels = new Set<string>();
  for (const guess of guesses) {
    const match = puzzle.groups.find((g) => sortedKey(g.words) === sortedKey(guess));
    if (match && !solvedLabels.has(match.label)) {
      solved.push(match);
      solvedLabels.add(match.label);
    }
  }
  return solved;
}

export function solvedWordSet(guesses: readonly string[][], puzzle: ConnectionsPuzzle): Set<string> {
  return new Set(solvedGroups(guesses, puzzle).flatMap((g) => g.words));
}

export function countMistakes(guesses: readonly string[][], puzzle: ConnectionsPuzzle): number {
  return guesses.filter((g) => evaluateGuess(g, puzzle) !== "correct").length;
}

export function isWon(guesses: readonly string[][], puzzle: ConnectionsPuzzle): boolean {
  return solvedGroups(guesses, puzzle).length === puzzle.groups.length;
}

export function isLost(guesses: readonly string[][], puzzle: ConnectionsPuzzle): boolean {
  return !isWon(guesses, puzzle) && countMistakes(guesses, puzzle) >= MAX_MISTAKES;
}

export function isOver(guesses: readonly string[][], puzzle: ConnectionsPuzzle): boolean {
  return isWon(guesses, puzzle) || isLost(guesses, puzzle);
}

/** Unsolved groups, ascending by level — the order a loss reveals them in. */
export function remainingGroupsByLevel(guesses: readonly string[][], puzzle: ConnectionsPuzzle): ConnectionsGroup[] {
  const solvedLabels = new Set(solvedGroups(guesses, puzzle).map((g) => g.label));
  return puzzle.groups.filter((g) => !solvedLabels.has(g.label)).sort((a, b) => a.level - b.level);
}

const LEVEL_EMOJI = ["🟨", "🟩", "🟦", "🟪"] as const;

/**
 * Spoiler-free share text: title, puzzle number, one emoji row per submitted guess (never an
 * auto-revealed group from a loss, since those weren't actually guessed), each square coloured by
 * the group the selected word actually belongs to. Never includes a word or a group label.
 */
export function buildSummary(
  guesses: readonly string[][],
  puzzle: ConnectionsPuzzle,
  puzzleNumber: number,
): string {
  const levelByWord = new Map<string, 0 | 1 | 2 | 3>();
  for (const g of puzzle.groups) for (const w of g.words) levelByWord.set(w, g.level);

  const grid = guesses
    .map((guess) => guess.map((w) => LEVEL_EMOJI[levelByWord.get(w) ?? 0]).join(""))
    .join("\n");

  return `Connections #${puzzleNumber}\n\n${grid}\n\n${SITE_URL}`;
}
