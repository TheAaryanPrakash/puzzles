import { describe, it, expect } from "vitest";
import {
  CONFIG,
  defaultState,
  setEntry,
  isWon,
  isBoardFull,
  buildSummary,
  type SudokuPuzzle,
} from "./logic";

function makePuzzle(): SudokuPuzzle {
  const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1));
  const puzzle = solution.map((row, r) => row.map((v, c) => ((r + c) % 2 === 0 ? v : 0)));
  return { puzzle, solution, difficulty: "medium" };
}

describe("defaultState", () => {
  it("starts from the puzzle's own givens, sized for a 9x9 board", () => {
    const puzzle = makePuzzle();
    const state = defaultState(puzzle);
    expect(state.entries).toEqual(puzzle.puzzle);
    expect(state.entries.length).toBe(CONFIG.size);
    expect(state.elapsed).toBe(0);
  });
});

describe("isWon / isBoardFull", () => {
  it("is not won while cells are missing", () => {
    const puzzle = makePuzzle();
    const state = defaultState(puzzle);
    expect(isBoardFull(state.entries)).toBe(false);
    expect(isWon(state, puzzle)).toBe(false);
  });

  it("is won only once every cell matches the solution", () => {
    const puzzle = makePuzzle();
    let state = defaultState(puzzle);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.entries[r][c] === 0) state = setEntry(state, puzzle, r, c, puzzle.solution[r][c]);
      }
    }
    expect(isBoardFull(state.entries)).toBe(true);
    expect(isWon(state, puzzle)).toBe(true);
  });

  it("a full-but-wrong board is not a win", () => {
    const puzzle = makePuzzle();
    let state = defaultState(puzzle);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.entries[r][c] === 0) {
          const wrong = (puzzle.solution[r][c] % 9) + 1;
          state = setEntry(state, puzzle, r, c, wrong);
        }
      }
    }
    expect(isBoardFull(state.entries)).toBe(true);
    expect(isWon(state, puzzle)).toBe(false);
  });
});

describe("buildSummary", () => {
  it("never contains any grid digits — it never receives the grid or solution at all", () => {
    // buildSummary's signature only accepts (puzzleNumber, difficulty, elapsedSeconds), so there
    // is no grid data in scope to leak; this just pins down what it does render.
    const summary = buildSummary(42, "hard", 187);
    expect(summary).toContain("#42");
    expect(summary).toContain("3:07");
    expect(summary).toContain("🔴");
  });

  it("formats elapsed seconds as m:ss", () => {
    expect(buildSummary(1, "easy", 5)).toContain("0:05");
    expect(buildSummary(1, "easy", 65)).toContain("1:05");
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical game", () => {
    const puzzle = makePuzzle();
    let state = defaultState(puzzle);
    state = setEntry(state, puzzle, 0, 1, 5);
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored).toEqual(state);
    expect(isWon(restored, puzzle)).toBe(isWon(state, puzzle));
  });
});
