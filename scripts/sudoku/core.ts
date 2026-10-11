// Shared generation engine for sudoku (9x9/3x3) and mini-sudoku (6x6/2x3). Pure, deterministic
// grid math — no filesystem, no CLAUDE.md config imports — so both scripts/sudoku/generate.ts and
// scripts/mini-sudoku/generate.ts can drive it with their own seed, config and clue ranges.

export interface BoardConfig {
  size: number;
  boxH: number;
  boxW: number;
}

export type Grid = number[][]; // 0 = empty

export function assertValidConfig(config: BoardConfig): void {
  if (config.boxH * config.boxW !== config.size) {
    throw new Error(
      `invalid BoardConfig: boxH (${config.boxH}) * boxW (${config.boxW}) must equal size (${config.size})`,
    );
  }
}

export function emptyGrid(config: BoardConfig): Grid {
  return Array.from({ length: config.size }, () => Array(config.size).fill(0));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

function boxTopLeft(row: number, col: number, config: BoardConfig): { r0: number; c0: number } {
  return {
    r0: Math.floor(row / config.boxH) * config.boxH,
    c0: Math.floor(col / config.boxW) * config.boxW,
  };
}

/** Whether `value` can legally go at (row, col) given the rest of the grid (ignoring the cell itself). */
export function canPlace(grid: Grid, row: number, col: number, value: number, config: BoardConfig): boolean {
  for (let i = 0; i < config.size; i++) {
    if (i !== col && grid[row][i] === value) return false;
    if (i !== row && grid[i][col] === value) return false;
  }
  const { r0, c0 } = boxTopLeft(row, col, config);
  for (let r = r0; r < r0 + config.boxH; r++) {
    for (let c = c0; c < c0 + config.boxW; c++) {
      if ((r !== row || c !== col) && grid[r][c] === value) return false;
    }
  }
  return true;
}

/** Legal candidate values for an empty cell, given the current grid. */
export function candidatesFor(grid: Grid, row: number, col: number, config: BoardConfig): number[] {
  const result: number[] = [];
  for (let v = 1; v <= config.size; v++) {
    if (canPlace(grid, row, col, v, config)) result.push(v);
  }
  return result;
}

/** The empty cell with the fewest legal candidates (MRV heuristic), or null if the grid is full. */
function findMrvCell(
  grid: Grid,
  config: BoardConfig,
): { row: number; col: number; candidates: number[] } | null {
  let best: { row: number; col: number; candidates: number[] } | null = null;
  for (let row = 0; row < config.size; row++) {
    for (let col = 0; col < config.size; col++) {
      if (grid[row][col] !== 0) continue;
      const candidates = candidatesFor(grid, row, col, config);
      if (candidates.length === 0) return { row, col, candidates }; // dead end — surface it immediately
      if (!best || candidates.length < best.candidates.length) {
        best = { row, col, candidates };
        if (candidates.length === 1) return best; // can't do better than a forced cell
      }
    }
  }
  return best;
}

/**
 * Fills `grid` (mutated in place) into a complete, valid solution using MRV backtracking with
 * candidate order shuffled by `rng`. Used once per day to build the base solved grid. Returns
 * false (grid left in a partially-filled, inconsistent state) only if the starting grid has no
 * solution at all — never happens for an empty grid, so callers pass `emptyGrid(config)`.
 */
export function fillRandomSolution(grid: Grid, config: BoardConfig, rng: () => number): boolean {
  const cell = findMrvCell(grid, config);
  if (!cell) return true; // full grid, solved
  if (cell.candidates.length === 0) return false;

  const order = shuffleInPlace(cell.candidates.slice(), rng);
  for (const value of order) {
    grid[cell.row][cell.col] = value;
    if (fillRandomSolution(grid, config, rng)) return true;
    grid[cell.row][cell.col] = 0;
  }
  return false;
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Counts solutions to `grid` via MRV backtracking, stopping as soon as `limit` is reached (we only
 * ever need to know "is this unique?", i.e. whether the count is exactly 1, so `limit = 2` is
 * enough and keeps this fast even on very under-constrained grids).
 */
export function countSolutions(grid: Grid, config: BoardConfig, limit: number): number {
  const working = cloneGrid(grid);
  let count = 0;

  function search(): void {
    if (count >= limit) return;
    const cell = findMrvCell(working, config);
    if (!cell) {
      count++;
      return;
    }
    if (cell.candidates.length === 0) return;
    for (const value of cell.candidates) {
      working[cell.row][cell.col] = value;
      search();
      working[cell.row][cell.col] = 0;
      if (count >= limit) return;
    }
  }

  search();
  return count;
}

export function clueCount(grid: Grid): number {
  let n = 0;
  for (const row of grid) for (const v of row) if (v !== 0) n++;
  return n;
}

/**
 * Removes cells from a fully-solved `grid` one at a time, in an order shuffled by `rng`, keeping a
 * removal only if the puzzle still has exactly one solution. Stops once `targetClues` is reached or
 * every cell has been tried. Returns a new grid; `solved` is never mutated.
 */
export function digHoles(solved: Grid, config: BoardConfig, rng: () => number, targetClues: number): Grid {
  const puzzle = cloneGrid(solved);
  const cells: [number, number][] = [];
  for (let r = 0; r < config.size; r++) for (let c = 0; c < config.size; c++) cells.push([r, c]);
  shuffleInPlace(cells, rng);

  for (const [r, c] of cells) {
    if (clueCount(puzzle) <= targetClues) break;
    const removed = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, config, 2) !== 1) {
      puzzle[r][c] = removed; // would break uniqueness — put it back
    }
  }
  return puzzle;
}

/** Deterministic Mulberry32 PRNG, seeded per day from a base seed + the puzzle's own date string. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Combines a game's base seed with a puzzle date into one deterministic Mulberry32 seed. */
export function seedForDay(baseSeed: number, date: string): number {
  let h = baseSeed >>> 0;
  for (let i = 0; i < date.length; i++) {
    h = (Math.imul(h, 33) ^ date.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}
