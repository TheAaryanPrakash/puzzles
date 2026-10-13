import {
  type BoardConfig,
  type BoardState,
  type Grid,
  type Highlight,
  defaultBoardState,
  setEntry as engineSetEntry,
  toggleNote as engineToggleNote,
  eraseCell as engineEraseCell,
  findConflicts as engineFindConflicts,
  getHighlight as engineGetHighlight,
  isFull,
  isSolved,
} from "./shared/engine";
import { SITE_URL } from "../../config";

export type { BoardState as SudokuState, Highlight } from "./shared/engine";

export const CONFIG: BoardConfig = { size: 9, boxH: 3, boxW: 3 };

export type Difficulty = "easy" | "medium" | "hard";

export interface SudokuPuzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
}

/**
 * A freshly-started play's `state` is `{}` right after `start()` resolves (the database's own
 * `default '{}'::jsonb`, mirrored by the local adapter) — not yet shaped like SudokuState. Always
 * derive state as `{ ...defaultState(puzzle), ...play?.state }`, never `play?.state ?? ...`: the
 * latter only catches null/undefined, so it still crashes on that empty-but-truthy `{}`. This is a
 * function of `puzzle` (not a plain constant) because the board size and given clues depend on
 * which day's puzzle loaded — see RESEARCH.md "Chosen design".
 */
export function defaultState(puzzle: SudokuPuzzle): BoardState {
  return defaultBoardState(puzzle.puzzle, CONFIG.size);
}

export function setEntry(state: BoardState, puzzle: SudokuPuzzle, row: number, col: number, value: number): BoardState {
  return engineSetEntry(state, puzzle.puzzle, row, col, value);
}

export function toggleNote(state: BoardState, puzzle: SudokuPuzzle, row: number, col: number, value: number): BoardState {
  return engineToggleNote(state, puzzle.puzzle, row, col, value);
}

export function eraseCell(state: BoardState, puzzle: SudokuPuzzle, row: number, col: number): BoardState {
  return engineEraseCell(state, puzzle.puzzle, row, col);
}

export function findConflicts(entries: Grid): Set<string> {
  return engineFindConflicts(entries, CONFIG);
}

export function getHighlight(selected: { row: number; col: number } | null, entries: Grid): Highlight {
  return engineGetHighlight(selected, entries, CONFIG);
}

export function isBoardFull(entries: Grid): boolean {
  return isFull(entries);
}

export function isWon(state: BoardState, puzzle: SudokuPuzzle): boolean {
  return isSolved(state.entries, puzzle.solution);
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DIFFICULTY_EMOJI: Record<Difficulty, string> = { easy: "🟢", medium: "🟡", hard: "🔴" };

/**
 * Spoiler-free share text: puzzle number, difficulty and solve time only — the grid and solution
 * are never passed in, so there's nothing here that could leak either (see logic.test.ts).
 */
export function buildSummary(puzzleNumber: number, difficulty: Difficulty, elapsedSeconds: number): string {
  return `Sudoku #${puzzleNumber} ${DIFFICULTY_EMOJI[difficulty]} — solved in ${formatElapsed(elapsedSeconds)} 🧩\n\n${SITE_URL}`;
}
