// Shared board-state engine for sudoku (9x9/3x3) and mini-sudoku (6x6/2x3). Pure functions only —
// no React, no DataSource — so both games' logic.ts can wrap it with their own Puzzle/State types
// per the game contract, while sharing every rule about editing a board.
export interface BoardConfig {
  size: number;
  boxH: number;
  boxW: number;
}

export type Grid = number[][]; // 0 = empty
export type NotesGrid = number[][][]; // notes[row][col] = sorted pencil-marked candidate values

export interface BoardState {
  entries: Grid;
  notes: NotesGrid;
  elapsed: number;
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

export function emptyNotes(size: number): NotesGrid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => []));
}

function cloneNotes(notes: NotesGrid): NotesGrid {
  return notes.map((row) => row.map((cell) => cell.slice()));
}

/** A board's starting state: the puzzle's own givens as entries, no notes, a fresh timer. */
export function defaultBoardState(puzzle: Grid, size: number): BoardState {
  return { entries: cloneGrid(puzzle), notes: emptyNotes(size), elapsed: 0 };
}

export function isGiven(puzzle: Grid, row: number, col: number): boolean {
  return puzzle[row][col] !== 0;
}

/** Sets a definite value in a non-given cell; clears that cell's notes (it's no longer a guess). */
export function setEntry(state: BoardState, puzzle: Grid, row: number, col: number, value: number): BoardState {
  if (isGiven(puzzle, row, col)) return state;
  const entries = cloneGrid(state.entries);
  entries[row][col] = value;
  const notes = cloneNotes(state.notes);
  notes[row][col] = [];
  return { ...state, entries, notes };
}

/** Toggles a pencil mark; a no-op on given cells and on cells that already hold a final entry. */
export function toggleNote(state: BoardState, puzzle: Grid, row: number, col: number, value: number): BoardState {
  if (isGiven(puzzle, row, col) || state.entries[row][col] !== 0) return state;
  const notes = cloneNotes(state.notes);
  const cell = notes[row][col];
  const idx = cell.indexOf(value);
  if (idx === -1) {
    cell.push(value);
    cell.sort((a, b) => a - b);
  } else {
    cell.splice(idx, 1);
  }
  return { ...state, notes };
}

export function eraseCell(state: BoardState, puzzle: Grid, row: number, col: number): BoardState {
  if (isGiven(puzzle, row, col)) return state;
  const entries = cloneGrid(state.entries);
  entries[row][col] = 0;
  const notes = cloneNotes(state.notes);
  notes[row][col] = [];
  return { ...state, entries, notes };
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function boxTopLeft(row: number, col: number, config: BoardConfig): { r0: number; c0: number } {
  return {
    r0: Math.floor(row / config.boxH) * config.boxH,
    c0: Math.floor(col / config.boxW) * config.boxW,
  };
}

/** Every other cell sharing this cell's row, column or box (each cell appears at most once, even
 *  when a box cell also shares the row or column — e.g. the 2 cells in a 3x3 box that are in the
 *  same row as the selected cell would otherwise be counted twice). */
export function getPeers(row: number, col: number, config: BoardConfig): [number, number][] {
  const seen = new Set<string>();
  const peers: [number, number][] = [];
  function add(r: number, c: number) {
    if (r === row && c === col) return;
    const key = cellKey(r, c);
    if (seen.has(key)) return;
    seen.add(key);
    peers.push([r, c]);
  }

  for (let i = 0; i < config.size; i++) {
    add(row, i);
    add(i, col);
  }
  const { r0, c0 } = boxTopLeft(row, col, config);
  for (let r = r0; r < r0 + config.boxH; r++) {
    for (let c = c0; c < c0 + config.boxW; c++) add(r, c);
  }
  return peers;
}

/** Cells (row,col keys) that currently violate the one-of-each-digit rule in a row, column or box. */
export function findConflicts(entries: Grid, config: BoardConfig): Set<string> {
  const conflicts = new Set<string>();
  for (let row = 0; row < config.size; row++) {
    for (let col = 0; col < config.size; col++) {
      const value = entries[row][col];
      if (value === 0) continue;
      for (const [pr, pc] of getPeers(row, col, config)) {
        if (entries[pr][pc] === value) {
          conflicts.add(cellKey(row, col));
          break;
        }
      }
    }
  }
  return conflicts;
}

export function isFull(entries: Grid): boolean {
  return entries.every((row) => row.every((v) => v !== 0));
}

export function isSolved(entries: Grid, solution: Grid): boolean {
  return entries.every((row, r) => row.every((v, c) => v === solution[r][c]));
}

export interface Highlight {
  /** Same row/column/box as the selected cell. */
  peers: Set<string>;
  /** Cells holding the same value as the selected cell (when it has one). */
  sameValue: Set<string>;
}

export function getHighlight(
  selected: { row: number; col: number } | null,
  entries: Grid,
  config: BoardConfig,
): Highlight {
  if (!selected) return { peers: new Set(), sameValue: new Set() };
  const peers = new Set(getPeers(selected.row, selected.col, config).map(([r, c]) => cellKey(r, c)));
  const sameValue = new Set<string>();
  const value = entries[selected.row][selected.col];
  if (value !== 0) {
    for (let r = 0; r < config.size; r++) {
      for (let c = 0; c < config.size; c++) {
        if (entries[r][c] === value) sameValue.add(cellKey(r, c));
      }
    }
  }
  return { peers, sameValue };
}
