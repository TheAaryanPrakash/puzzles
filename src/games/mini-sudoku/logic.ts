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
} from "../sudoku/shared/engine";

export type { BoardState as MiniSudokuState, Highlight } from "../sudoku/shared/engine";

export const CONFIG: BoardConfig = { size: 6, boxH: 2, boxW: 3 };

export type Difficulty = "easy" | "medium";

export interface MiniSudokuPuzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
}

/**
 * See sudoku/logic.ts's identical comment: `play.state` is briefly `{}` right after `start()`
 * resolves, so state is always derived as `{ ...defaultState(puzzle), ...play?.state }`, never
 * `play?.state ?? defaultState(puzzle)`.
 */
export function defaultState(puzzle: MiniSudokuPuzzle): BoardState {
  return defaultBoardState(puzzle.puzzle, CONFIG.size);
}

export function setEntry(state: BoardState, puzzle: MiniSudokuPuzzle, row: number, col: number, value: number): BoardState {
  return engineSetEntry(state, puzzle.puzzle, row, col, value);
}

export function toggleNote(state: BoardState, puzzle: MiniSudokuPuzzle, row: number, col: number, value: number): BoardState {
  return engineToggleNote(state, puzzle.puzzle, row, col, value);
}

export function eraseCell(state: BoardState, puzzle: MiniSudokuPuzzle, row: number, col: number): BoardState {
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

export function isWon(state: BoardState, puzzle: MiniSudokuPuzzle): boolean {
  return isSolved(state.entries, puzzle.solution);
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DIFFICULTY_EMOJI: Record<Difficulty, string> = { easy: "🟢", medium: "🟡" };

/**
 * Spoiler-free share text: puzzle number, difficulty and solve time only — the grid and solution
 * are never passed in, so there's nothing here that could leak either (see logic.test.ts).
 */
export function buildSummary(puzzleNumber: number, difficulty: Difficulty, elapsedSeconds: number): string {
  return `Mini Sudoku #${puzzleNumber} ${DIFFICULTY_EMOJI[difficulty]} — solved in ${formatElapsed(elapsedSeconds)} 🌸`;
}
