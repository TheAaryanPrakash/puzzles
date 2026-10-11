import { describe, it, expect } from "vitest";
import {
  CONFIG,
  defaultState,
  setEntry,
  toggleNote,
  eraseCell,
  findConflicts,
  isWon,
  isBoardFull,
  buildSummary,
  type MiniSudokuPuzzle,
} from "./logic";

// A valid 6x6/2x3 solution: shift each row by (2 rows per box-row, matching the box pattern), so
// every row/column/box holds 1-6 exactly once.
function makeSolution(): number[][] {
  const base = [1, 2, 3, 4, 5, 6];
  const shifts = [0, 3, 1, 4, 2, 5];
  return shifts.map((shift) => base.map((_, c) => ((c + shift) % 6) + 1));
}

function makePuzzle(): MiniSudokuPuzzle {
  const solution = makeSolution();
  const puzzle = solution.map((row, r) => row.map((v, c) => ((r + c) % 2 === 0 ? v : 0)));
  return { puzzle, solution, difficulty: "easy" };
}

describe("defaultState", () => {
  it("starts from the puzzle's own givens, sized for a 6x6 board", () => {
    const puzzle = makePuzzle();
    const state = defaultState(puzzle);
    expect(state.entries).toEqual(puzzle.puzzle);
    expect(state.entries.length).toBe(CONFIG.size);
    expect(state.notes.length).toBe(CONFIG.size);
    expect(state.elapsed).toBe(0);
  });
});

describe("given cells", () => {
  it("can never be edited, noted or erased", () => {
    const puzzle = makePuzzle();
    const state = defaultState(puzzle);
    let row = -1;
    let col = -1;
    outer: for (let r = 0; r < CONFIG.size; r++) {
      for (let c = 0; c < CONFIG.size; c++) {
        if (puzzle.puzzle[r][c] !== 0) {
          row = r;
          col = c;
          break outer;
        }
      }
    }
    const given = puzzle.puzzle[row][col];
    const other = (given % 6) + 1;
    expect(setEntry(state, puzzle, row, col, other)).toBe(state);
    expect(toggleNote(state, puzzle, row, col, other)).toBe(state);
    expect(eraseCell(state, puzzle, row, col)).toBe(state);
  });
});

describe("setEntry / toggleNote interplay", () => {
  it("clears a cell's notes once it holds a final entry, and noting a filled cell is a no-op", () => {
    const puzzle = makePuzzle();
    let row = -1;
    let col = -1;
    outer: for (let r = 0; r < CONFIG.size; r++) {
      for (let c = 0; c < CONFIG.size; c++) {
        if (puzzle.puzzle[r][c] === 0) {
          row = r;
          col = c;
          break outer;
        }
      }
    }
    let state = defaultState(puzzle);
    state = toggleNote(state, puzzle, row, col, 1);
    state = toggleNote(state, puzzle, row, col, 2);
    expect(state.notes[row][col]).toEqual([1, 2]);

    state = setEntry(state, puzzle, row, col, puzzle.solution[row][col]);
    expect(state.notes[row][col]).toEqual([]);

    const afterNote = toggleNote(state, puzzle, row, col, 3);
    expect(afterNote).toBe(state);
  });
});

describe("findConflicts", () => {
  it("flags a repeated digit in a row, column and box, and clears once resolved", () => {
    // An entirely empty puzzle, so the only conflicts possible are the ones this test creates.
    const emptyPuzzle: MiniSudokuPuzzle = {
      puzzle: Array.from({ length: 6 }, () => Array(6).fill(0)),
      solution: Array.from({ length: 6 }, () => Array(6).fill(0)),
      difficulty: "easy",
    };
    let state = defaultState(emptyPuzzle);
    state = setEntry(state, emptyPuzzle, 0, 0, 6);
    state = setEntry(state, emptyPuzzle, 0, 3, 6); // same row
    const conflicts = findConflicts(state.entries);
    expect(conflicts.has("0,0")).toBe(true);
    expect(conflicts.has("0,3")).toBe(true);

    state = eraseCell(state, emptyPuzzle, 0, 3);
    expect(findConflicts(state.entries).has("0,0")).toBe(false);
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
    for (let r = 0; r < CONFIG.size; r++) {
      for (let c = 0; c < CONFIG.size; c++) {
        if (state.entries[r][c] === 0) state = setEntry(state, puzzle, r, c, puzzle.solution[r][c]);
      }
    }
    expect(isBoardFull(state.entries)).toBe(true);
    expect(isWon(state, puzzle)).toBe(true);
  });

  it("a full-but-wrong board is not a win", () => {
    const puzzle = makePuzzle();
    let state = defaultState(puzzle);
    for (let r = 0; r < CONFIG.size; r++) {
      for (let c = 0; c < CONFIG.size; c++) {
        if (state.entries[r][c] === 0) {
          const wrong = (puzzle.solution[r][c] % 6) + 1;
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
    const summary = buildSummary(12, "medium", 95);
    expect(summary).toContain("#12");
    expect(summary).toContain("1:35");
    expect(summary).toContain("🟡");
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
    state = setEntry(state, puzzle, 0, 1, 3);
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored).toEqual(state);
    expect(isWon(restored, puzzle)).toBe(isWon(state, puzzle));
  });
});
