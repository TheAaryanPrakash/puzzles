import { describe, it, expect } from "vitest";
import {
  type BoardConfig,
  type Grid,
  assertValidConfig,
  emptyGrid,
  canPlace,
  fillRandomSolution,
  countSolutions,
  clueCount,
  digHoles,
  mulberry32,
  seedForDay,
} from "./core";

const SUDOKU: BoardConfig = { size: 9, boxH: 3, boxW: 3 };
const MINI: BoardConfig = { size: 6, boxH: 2, boxW: 3 };

function isValidCompleteGrid(grid: Grid, config: BoardConfig): boolean {
  const full = Array.from({ length: config.size }, (_, i) => i + 1);
  const sameSet = (values: number[]) =>
    full.every((v) => values.includes(v)) && values.length === config.size;

  for (let r = 0; r < config.size; r++) {
    if (!sameSet(grid[r])) return false;
  }
  for (let c = 0; c < config.size; c++) {
    if (!sameSet(grid.map((row) => row[c]))) return false;
  }
  for (let br = 0; br < config.size; br += config.boxH) {
    for (let bc = 0; bc < config.size; bc += config.boxW) {
      const box: number[] = [];
      for (let r = br; r < br + config.boxH; r++) {
        for (let c = bc; c < bc + config.boxW; c++) box.push(grid[r][c]);
      }
      if (!sameSet(box)) return false;
    }
  }
  return true;
}

describe("assertValidConfig", () => {
  it("accepts configs where boxH * boxW === size", () => {
    expect(() => assertValidConfig(SUDOKU)).not.toThrow();
    expect(() => assertValidConfig(MINI)).not.toThrow();
  });

  it("rejects a mismatched config", () => {
    expect(() => assertValidConfig({ size: 9, boxH: 2, boxW: 3 })).toThrow();
  });
});

describe.each([
  ["sudoku 9x9", SUDOKU],
  ["mini 6x6", MINI],
])("fillRandomSolution (%s)", (_label, config) => {
  it("produces a complete, valid solved grid", () => {
    const grid = emptyGrid(config);
    const ok = fillRandomSolution(grid, config, mulberry32(42));
    expect(ok).toBe(true);
    expect(isValidCompleteGrid(grid, config)).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const a = emptyGrid(config);
    const b = emptyGrid(config);
    fillRandomSolution(a, config, mulberry32(123));
    fillRandomSolution(b, config, mulberry32(123));
    expect(a).toEqual(b);
  });

  it("produces different grids for different seeds", () => {
    const a = emptyGrid(config);
    const b = emptyGrid(config);
    fillRandomSolution(a, config, mulberry32(1));
    fillRandomSolution(b, config, mulberry32(2));
    expect(a).not.toEqual(b);
  });
});

describe("canPlace", () => {
  it("rejects a value already in the row, column or box", () => {
    const grid = emptyGrid(SUDOKU);
    grid[0][0] = 5;
    expect(canPlace(grid, 0, 3, 5, SUDOKU)).toBe(false); // same row
    expect(canPlace(grid, 3, 0, 5, SUDOKU)).toBe(false); // same column
    expect(canPlace(grid, 1, 1, 5, SUDOKU)).toBe(false); // same box
    expect(canPlace(grid, 4, 4, 5, SUDOKU)).toBe(true); // unrelated cell
  });
});

describe("countSolutions", () => {
  it("reports 1 for a solved grid with every cell already filled", () => {
    const grid = emptyGrid(MINI);
    fillRandomSolution(grid, MINI, mulberry32(7));
    expect(countSolutions(grid, MINI, 2)).toBe(1);
  });

  it("reports more than 1 for a wide-open grid", () => {
    expect(countSolutions(emptyGrid(MINI), MINI, 2)).toBeGreaterThan(1);
  });

  it("stops counting once the limit is reached", () => {
    // An empty grid has many solutions; with limit 2 we should never scan them all.
    const count = countSolutions(emptyGrid(SUDOKU), SUDOKU, 2);
    expect(count).toBe(2);
  });
});

describe.each([
  ["sudoku 9x9", SUDOKU],
  ["mini 6x6", MINI],
])("digHoles (%s)", (_label, config) => {
  it("always leaves a puzzle with exactly one solution", () => {
    const solved = emptyGrid(config);
    fillRandomSolution(solved, config, mulberry32(99));
    const puzzle = digHoles(solved, config, mulberry32(100), Math.floor(config.size * config.size * 0.4));
    expect(countSolutions(puzzle, config, 2)).toBe(1);
  });

  it("never alters the given clues' values relative to the solution", () => {
    const solved = emptyGrid(config);
    fillRandomSolution(solved, config, mulberry32(55));
    const puzzle = digHoles(solved, config, mulberry32(56), Math.floor(config.size * config.size * 0.5));
    for (let r = 0; r < config.size; r++) {
      for (let c = 0; c < config.size; c++) {
        if (puzzle[r][c] !== 0) expect(puzzle[r][c]).toBe(solved[r][c]);
      }
    }
  });

  it("removes clues towards the target when the grid allows it", () => {
    const solved = emptyGrid(config);
    fillRandomSolution(solved, config, mulberry32(21));
    const target = Math.floor(config.size * config.size * 0.4);
    const puzzle = digHoles(solved, config, mulberry32(22), target);
    expect(clueCount(puzzle)).toBeLessThan(config.size * config.size);
  });
});

describe("seedForDay", () => {
  it("is deterministic for the same base seed and date", () => {
    expect(seedForDay(11, "2026-10-17")).toBe(seedForDay(11, "2026-10-17"));
  });

  it("differs across dates", () => {
    expect(seedForDay(11, "2026-10-17")).not.toBe(seedForDay(11, "2026-10-18"));
  });

  it("differs across base seeds for the same date", () => {
    expect(seedForDay(11, "2026-10-17")).not.toBe(seedForDay(12, "2026-10-17"));
  });
});
