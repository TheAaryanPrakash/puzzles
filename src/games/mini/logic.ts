// Pure game logic for the Mini crossword. No DOM, no React — see RESEARCH.md for the UX
// conventions these functions implement (cursor movement, auto-advance, direction toggle).
import { SITE_URL } from "../../config";

export type Direction = "across" | "down";

export interface MiniClue {
  number: number;
  clue: string;
  answer: string; // uppercase, no spaces/punctuation
  row: number;
  col: number;
  length: number;
  source: "dataset" | "written";
}

export interface MiniCellFilled {
  answer: string; // single uppercase letter
  number?: number; // set only on cells that start an across and/or down entry
}
export type MiniCell = MiniCellFilled | null; // null = black square

export interface MiniPuzzle {
  size: number;
  cells: MiniCell[]; // row-major, length size*size
  clues: { across: MiniClue[]; down: MiniClue[] };
}

export interface MiniState {
  letters: (string | null)[]; // row-major, player's input; null = empty or black
  elapsed: number; // seconds
  revealed: boolean;
}

/**
 * A freshly-started play's `state` is briefly `{}` (see CLAUDE.md's "{} gotcha"). Merge this in
 * with `{ ...DEFAULT_STATE, ...play?.state }` — never `play?.state ?? DEFAULT_STATE`. `letters`
 * starts empty here (puzzle-size-independent) and is padded to the right length by
 * `normalizeLetters` on every render, since the default can't know the puzzle's size.
 */
export const DEFAULT_STATE: MiniState = { letters: [], elapsed: 0, revealed: false };

export function emptyLetters(puzzle: MiniPuzzle): (string | null)[] {
  return puzzle.cells.map(() => null);
}

/** Pads/replaces a missing or mis-sized letters array so it always matches the puzzle's cells. */
export function normalizeLetters(
  letters: (string | null)[] | undefined,
  puzzle: MiniPuzzle,
): (string | null)[] {
  if (!letters || letters.length !== puzzle.cells.length) return emptyLetters(puzzle);
  return letters;
}

export function cellIndex(puzzle: MiniPuzzle, row: number, col: number): number {
  return row * puzzle.size + col;
}

export function isBlack(puzzle: MiniPuzzle, row: number, col: number): boolean {
  if (row < 0 || row >= puzzle.size || col < 0 || col >= puzzle.size) return true;
  return puzzle.cells[cellIndex(puzzle, row, col)] === null;
}

/** The row-major cell indices spanned by one clue entry, in order. */
export function wordCells(puzzle: MiniPuzzle, direction: Direction, clue: MiniClue): number[] {
  const cells: number[] = [];
  for (let i = 0; i < clue.length; i++) {
    const r = direction === "across" ? clue.row : clue.row + i;
    const c = direction === "across" ? clue.col + i : clue.col;
    cells.push(cellIndex(puzzle, r, c));
  }
  return cells;
}

/** The clue (if any) in `direction` that covers (row, col). */
export function clueAt(
  puzzle: MiniPuzzle,
  direction: Direction,
  row: number,
  col: number,
): MiniClue | undefined {
  return puzzle.clues[direction].find((c) =>
    direction === "across"
      ? c.row === row && col >= c.col && col < c.col + c.length
      : c.col === col && row >= c.row && row < c.row + c.length,
  );
}

export function cluesAt(
  puzzle: MiniPuzzle,
  row: number,
  col: number,
): { across?: MiniClue; down?: MiniClue } {
  return {
    across: clueAt(puzzle, "across", row, col),
    down: clueAt(puzzle, "down", row, col),
  };
}

/** Which directions actually have a (length ≥ 2) entry through this cell. */
export function activeDirections(puzzle: MiniPuzzle, row: number, col: number): Direction[] {
  const { across, down } = cluesAt(puzzle, row, col);
  const dirs: Direction[] = [];
  if (across) dirs.push("across");
  if (down) dirs.push("down");
  return dirs;
}

export interface Cursor {
  row: number;
  col: number;
  direction: Direction;
}

/**
 * Resolves the direction a click/tap on (row, col) should select. Re-tapping the currently
 * selected cell toggles direction (the standard crossword convention), but only to a direction
 * that actually has an entry there; otherwise it keeps the current direction if valid, falling
 * back to whichever direction does exist.
 */
export function resolveTapDirection(
  puzzle: MiniPuzzle,
  row: number,
  col: number,
  current: Cursor | null,
): Direction {
  const dirs = activeDirections(puzzle, row, col);
  if (dirs.length === 0) return "across";
  const sameCell = current && current.row === row && current.col === col;
  if (sameCell) {
    const other: Direction = current!.direction === "across" ? "down" : "across";
    if (dirs.includes(other)) return other;
  }
  if (current && dirs.includes(current.direction)) return current.direction;
  return dirs[0];
}

/** Moves one step along `direction`'s word from (row, col); null at the word's start/end. */
function stepInWord(
  puzzle: MiniPuzzle,
  clue: MiniClue,
  direction: Direction,
  row: number,
  col: number,
  step: 1 | -1,
): { row: number; col: number } | null {
  const cells = wordCells(puzzle, direction, clue);
  const i = cells.indexOf(cellIndex(puzzle, row, col));
  const next = cells[i + step];
  if (next === undefined) return null;
  return { row: Math.floor(next / puzzle.size), col: next % puzzle.size };
}

/**
 * Where the cursor goes right after typing a letter at (row, col): the next empty cell in the
 * current word if there is one, else just the next cell in the word (NYT's own convention — it
 * does not jump to the next clue automatically), else stays put if already at the word's end.
 */
export function advanceAfterType(
  puzzle: MiniPuzzle,
  letters: (string | null)[],
  direction: Direction,
  row: number,
  col: number,
): Cursor {
  const clue = clueAt(puzzle, direction, row, col);
  if (!clue) return { row, col, direction };
  const cells = wordCells(puzzle, direction, clue);
  const i = cells.indexOf(cellIndex(puzzle, row, col));
  const rest = cells.slice(i + 1);
  const nextEmpty = rest.find((idx) => !letters[idx]);
  const target = nextEmpty ?? cells[i + 1];
  if (target === undefined) return { row, col, direction };
  return { row: Math.floor(target / puzzle.size), col: target % puzzle.size, direction };
}

/** Where the cursor goes after Backspace clears (row, col): one cell back in the current word. */
export function retreatAfterDelete(
  puzzle: MiniPuzzle,
  direction: Direction,
  row: number,
  col: number,
): Cursor {
  const clue = clueAt(puzzle, direction, row, col);
  if (!clue) return { row, col, direction };
  const back = stepInWord(puzzle, clue, direction, row, col, -1);
  return back ? { ...back, direction } : { row, col, direction };
}

/**
 * Arrow-key movement: one step in the key's direction, switching the active direction when the
 * key's axis differs from the current one (e.g. pressing Left while typing Down switches to
 * Across) — the standard crossword convention. A step onto a black square or off the grid is a
 * no-op (arrow keys don't jump over blocks; Tab does that, via `moveToAdjacentClue`).
 */
export function moveArrow(
  puzzle: MiniPuzzle,
  row: number,
  col: number,
  direction: Direction,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
): Cursor {
  const delta: Record<typeof key, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const [dr, dc] = delta[key];
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  const newDirection: Direction = horizontal
    ? "across"
    : (key === "ArrowUp" || key === "ArrowDown") && direction === "across"
      ? "down"
      : direction;
  const nr = row + dr;
  const nc = col + dc;
  if (isBlack(puzzle, nr, nc)) return { row, col, direction: newDirection };
  return { row: nr, col: nc, direction: newDirection };
}

/** All clue entries in numbering order: every across clue, then every down clue. */
function clueSequence(puzzle: MiniPuzzle): { direction: Direction; clue: MiniClue }[] {
  return [
    ...puzzle.clues.across.map((clue) => ({ direction: "across" as const, clue })),
    ...puzzle.clues.down.map((clue) => ({ direction: "down" as const, clue })),
  ];
}

/** Tab (or the mobile clue bar's next/prev): jumps to the first cell of the next/prev clue. */
export function moveToAdjacentClue(
  puzzle: MiniPuzzle,
  direction: Direction,
  number: number,
  step: 1 | -1,
): Cursor {
  const seq = clueSequence(puzzle);
  const i = seq.findIndex((e) => e.direction === direction && e.clue.number === number);
  const target = seq[(((i + step) % seq.length) + seq.length) % seq.length];
  return { row: target.clue.row, col: target.clue.col, direction: target.direction };
}

export function isFilled(puzzle: MiniPuzzle, letters: (string | null)[]): boolean {
  return puzzle.cells.every((cell, i) => cell === null || !!letters[i]);
}

export function isSolved(puzzle: MiniPuzzle, letters: (string | null)[]): boolean {
  return puzzle.cells.every((cell, i) => cell === null || letters[i] === cell.answer);
}

export function revealedLetters(puzzle: MiniPuzzle): (string | null)[] {
  return puzzle.cells.map((cell) => (cell ? cell.answer : null));
}

/** Which currently-filled cells are wrong — for a non-destructive "Check" action. */
export function wrongCells(puzzle: MiniPuzzle, letters: (string | null)[]): number[] {
  const wrong: number[] = [];
  puzzle.cells.forEach((cell, i) => {
    if (cell && letters[i] && letters[i] !== cell.answer) wrong.push(i);
  });
  return wrong;
}

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

/**
 * Spoiler-free share text: puzzle number, solve time (or that the answers were revealed), and a
 * black/white grid shape — never an answer letter.
 */
export function buildSummary(
  puzzle: MiniPuzzle,
  puzzleNumber: number,
  elapsedSeconds: number,
  revealed: boolean,
): string {
  const grid = Array.from({ length: puzzle.size }, (_, r) =>
    Array.from({ length: puzzle.size }, (_, c) => (isBlack(puzzle, r, c) ? "⬛" : "🟩")).join(""),
  ).join("\n");
  const status = revealed ? "Peeked at the answers 👀" : `Solved in ${formatElapsed(elapsedSeconds)} ⏱️`;
  return `Mini #${puzzleNumber}\n${status}\n${grid}\n\n${SITE_URL}`;
}
