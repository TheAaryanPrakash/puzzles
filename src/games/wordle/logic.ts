import { scoreGuess, type LetterState } from "../../lib/wordle-score";
import type { KeyState } from "../../components/types";

export interface WordlePuzzle {
  answer: string;
}

export interface WordleState {
  guesses: string[];
  hardMode: boolean;
}

/**
 * A freshly-started play's `state` is `{}`, not yet shaped like WordleState — always derive state
 * as `{ ...DEFAULT_STATE, ...play?.state }`, never `play?.state ?? DEFAULT_STATE` (see CLAUDE.md
 * "The `{}` gotcha").
 */
export const DEFAULT_STATE: WordleState = { guesses: [], hardMode: false };

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5;

export function isWon(state: WordleState, answer: string): boolean {
  return state.guesses.some((g) => g.toUpperCase() === answer.toUpperCase());
}

export function isLost(state: WordleState, answer: string): boolean {
  return !isWon(state, answer) && state.guesses.length >= MAX_GUESSES;
}

export function isOver(state: WordleState, answer: string): boolean {
  return isWon(state, answer) || isLost(state, answer);
}

/** Per-tile feedback for one submitted guess row. */
export function rowFeedback(guess: string, answer: string): LetterState[] {
  return scoreGuess(guess, answer);
}

const STATE_PRIORITY: Record<LetterState, number> = { correct: 3, present: 2, absent: 1 };

/**
 * Each letter's *best* state across every guess so far (correct > present > absent), for the
 * shared Keyboard component — a letter never downgrades once it's earned a better colour.
 */
export function keyboardStates(guesses: string[], answer: string): Record<string, KeyState> {
  const states: Record<string, KeyState> = {};
  for (const guess of guesses) {
    const feedback = rowFeedback(guess, answer);
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i].toUpperCase();
      const next = feedback[i];
      const current = states[letter] as LetterState | undefined;
      if (!current || STATE_PRIORITY[next] > STATE_PRIORITY[current]) {
        states[letter] = next;
      }
    }
  }
  return states;
}

interface HardModeConstraints {
  /** index -> the letter that must be in that position (from a past "correct"). */
  positions: Map<number, string>;
  /** letters that must appear somewhere in the guess (from a past "present"). */
  letters: Set<string>;
}

function hardModeConstraints(guesses: string[], answer: string): HardModeConstraints {
  const positions = new Map<number, string>();
  const letters = new Set<string>();
  for (const guess of guesses) {
    const feedback = rowFeedback(guess, answer);
    feedback.forEach((state, i) => {
      const letter = guess[i].toUpperCase();
      if (state === "correct") positions.set(i, letter);
      else if (state === "present") letters.add(letter);
    });
  }
  return { positions, letters };
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

/**
 * Hard mode (NYT rules): every letter revealed `correct` must stay in that position, and every
 * letter revealed `present` must appear somewhere, in every later guess. Grey letters are never
 * enforced. Returns the first violation found (position checks before contains-checks, lowest
 * index first — matching the order NYT itself reports them), or null if the guess is clean.
 */
export function hardModeViolation(guess: string, previousGuesses: string[], answer: string): string | null {
  const { positions, letters } = hardModeConstraints(previousGuesses, answer);
  const g = guess.toUpperCase();

  for (const [pos, letter] of [...positions.entries()].sort((a, b) => a[0] - b[0])) {
    if (g[pos] !== letter) return `${ORDINALS[pos]} letter must be ${letter}`;
  }
  for (const letter of letters) {
    if (!g.includes(letter)) return `Guess must contain ${letter}`;
  }
  return null;
}

/** A full-sentence announcement for the aria-live region, read once per submitted guess. */
export function describeGuess(guess: string, answer: string, rowNumber: number): string {
  const feedback = rowFeedback(guess, answer);
  const parts = guess
    .toUpperCase()
    .split("")
    .map((letter, i) => `${letter}, ${feedback[i]}`);
  return `Guess ${rowNumber}: ${parts.join(". ")}.`;
}

const TILE_EMOJI: Record<LetterState, string> = { correct: "🟩", present: "🟨", absent: "⬛" };

/** Spoiler-free share text: puzzle number, tries/6 (or X/6), and an emoji grid — never the answer. */
export function buildSummary(state: WordleState, answer: string, puzzleNumber: number): string {
  const won = isWon(state, answer);
  const tries = won ? state.guesses.length : "X";
  const grid = state.guesses
    .map((guess) => rowFeedback(guess, answer).map((s) => TILE_EMOJI[s]).join(""))
    .join("\n");
  return `Wordle #${puzzleNumber} ${tries}/${MAX_GUESSES}\n\n${grid}\n\nSansita's Puzzles`;
}
