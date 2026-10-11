import { scoreGuess, type LetterState } from "../../lib/wordle-score";
import type { KeyState } from "../../components/types";

export const BOARD_COUNT = 4;
export const WORD_LENGTH = 5;
/** Same four tints as theme.css's `--quordle-board-1..4`, duplicated here as literal hex values
 * because `ResultModal` renders through a `createPortal` outside `[data-game="quordle"]` — CSS
 * custom properties scoped to that selector don't reach portaled content, so anything drawn inside
 * the result modal (e.g. the win recap) needs the color as a plain value, not a `var()` lookup. */
export const BOARD_COLORS = ["#5144a7", "#2d766f", "#b43f2d", "#726a18"] as const;
/** Quordle's shared guess budget: boards + 5, the formula every multi-board Wordle variant uses
 * (see RESEARCH.md) — enough slack to solve 4 words without needing to play perfectly. */
export const MAX_GUESSES = BOARD_COUNT + 5;

export interface QuordlePuzzle {
  answers: [string, string, string, string];
}

export interface QuordleState {
  /** One shared list — every guess is scored against all four answers at once. */
  guesses: string[];
}

/**
 * A freshly-started play's `state` is `{}` (the database's `default '{}'::jsonb`, mirrored by the
 * local adapter) — not yet shaped like QuordleState. Always derive state as
 * `{ ...DEFAULT_STATE, ...play?.state }`, never `play?.state ?? DEFAULT_STATE`: the latter only
 * falls back when `play` itself is null/undefined, so it still crashes on the empty-but-truthy `{}`
 * a game sees in the render right after `start()` resolves and before its first `save()` lands.
 */
export const DEFAULT_STATE: QuordleState = { guesses: [] };

const RANK: Record<LetterState, number> = { correct: 3, present: 2, absent: 1 };

/** 1-based guess number that solved this board, or null if it isn't solved (yet). */
export function boardSolvedAt(guesses: readonly string[], answer: string): number | null {
  const index = guesses.indexOf(answer);
  return index === -1 ? null : index + 1;
}

export function isBoardSolved(guesses: readonly string[], answer: string): boolean {
  return boardSolvedAt(guesses, answer) !== null;
}

/**
 * The guesses a board should actually render: once solved it's frozen at the guess that solved it,
 * even though the shared list keeps growing for the boards still in progress ("each guess applies
 * to every unsolved board" — CLAUDE.md / the task prompt).
 */
export function boardGuesses(guesses: readonly string[], answer: string): string[] {
  const solvedAt = boardSolvedAt(guesses, answer);
  return solvedAt === null ? [...guesses] : guesses.slice(0, solvedAt);
}

export function isWon(state: QuordleState, answers: readonly string[]): boolean {
  return answers.every((answer) => isBoardSolved(state.guesses, answer));
}

export function isLost(state: QuordleState, answers: readonly string[]): boolean {
  return !isWon(state, answers) && state.guesses.length >= MAX_GUESSES;
}

export function isOver(state: QuordleState, answers: readonly string[]): boolean {
  return isWon(state, answers) || isLost(state, answers);
}

/** Per-board tile colors for one guess, reusing the same two-pass scoring Wordle uses. */
export function scoreForBoard(guess: string, answer: string): LetterState[] {
  return scoreGuess(guess, answer);
}

/** Best state seen so far for each letter, against one board — never downgrades (correct beats
 *  present beats absent), scanning only that board's visible (pre-solve) guesses. */
export function keyStatesForBoard(guesses: readonly string[], answer: string): Partial<Record<string, LetterState>> {
  const states: Partial<Record<string, LetterState>> = {};
  for (const guess of guesses) {
    const scored = scoreForBoard(guess, answer);
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const next = scored[i];
      const prev = states[letter];
      if (!prev || RANK[next] > RANK[prev]) states[letter] = next;
    }
  }
  return states;
}

const ALPHABET = "QWERTYUIOPASDFGHJKLZXCVBNM".split("");

/** One KeyState per board (in board order) for every letter — feeds the quadrant keyboard. */
export function combinedKeyStates(
  state: QuordleState,
  answers: readonly string[],
): Record<string, KeyState[]> {
  const perBoard = answers.map((answer) => keyStatesForBoard(boardGuesses(state.guesses, answer), answer));
  const result: Record<string, KeyState[]> = {};
  for (const letter of ALPHABET) {
    result[letter] = perBoard.map((states) => states[letter] ?? "unused");
  }
  return result;
}

export function isValidGuessWord(guess: string, validGuesses: ReadonlySet<string>): boolean {
  const upper = guess.toUpperCase();
  return upper.length === WORD_LENGTH && validGuesses.has(upper);
}

const DIGIT_EMOJI = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

/**
 * Spoiler-free share text: one digit-emoji per board for the guess that solved it (🟥 if it
 * wasn't), arranged in the same 2x2 order as the boards. Never contains a letter, let alone an
 * answer. Matches the real game's own numeric-recap convention (see RESEARCH.md) rather than an
 * emoji letter-grid.
 */
export function buildSummary(
  state: QuordleState,
  answers: readonly string[],
  puzzleNumber: number,
): string {
  const won = isWon(state, answers);
  const symbols = answers.map((answer) => {
    const solvedAt = boardSolvedAt(state.guesses, answer);
    return solvedAt === null ? "🟥" : DIGIT_EMOJI[solvedAt];
  });
  const grid = `${symbols[0]}${symbols[1]}\n${symbols[2]}${symbols[3]}`;
  return `Quordle #${puzzleNumber} ${won ? "🎉" : "X"}/${MAX_GUESSES}\n${grid}`;
}
