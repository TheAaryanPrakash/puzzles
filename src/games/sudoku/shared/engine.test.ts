import { describe, it, expect } from "vitest";
import {
  type BoardConfig,
  type Grid,
  defaultBoardState,
  setEntry,
  toggleNote,
  eraseCell,
  findConflicts,
  isFull,
  isSolved,
  getHighlight,
  getPeers,
} from "./engine";

const SUDOKU: BoardConfig = { size: 9, boxH: 3, boxW: 3 };

function samplePuzzle(): Grid {
  // A minimal 9x9 fixture: enough givens to exercise given/empty cells and a shared row/col/box.
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  grid[0][0] = 5;
  grid[0][8] = 9;
  grid[8][0] = 1;
  grid[4][4] = 7;
  return grid;
}

describe("defaultBoardState", () => {
  it("starts entries as a copy of the puzzle's givens, no notes, elapsed 0", () => {
    const puzzle = samplePuzzle();
    const state = defaultBoardState(puzzle, 9);
    expect(state.entries).toEqual(puzzle);
    expect(state.entries).not.toBe(puzzle); // must be a copy, not an alias
    expect(state.notes.every((row) => row.every((cell) => cell.length === 0))).toBe(true);
    expect(state.elapsed).toBe(0);
  });
});

describe("setEntry / eraseCell / toggleNote", () => {
  it("never edits a given cell", () => {
    const puzzle = samplePuzzle();
    const state = defaultBoardState(puzzle, 9);
    expect(setEntry(state, puzzle, 0, 0, 3).entries[0][0]).toBe(5);
    expect(eraseCell(state, puzzle, 0, 0).entries[0][0]).toBe(5);
    expect(toggleNote(state, puzzle, 0, 0, 3).notes[0][0]).toEqual([]);
  });

  it("sets a value in a blank cell and clears its notes", () => {
    const puzzle = samplePuzzle();
    let state = defaultBoardState(puzzle, 9);
    state = toggleNote(state, puzzle, 1, 1, 4);
    expect(state.notes[1][1]).toEqual([4]);
    state = setEntry(state, puzzle, 1, 1, 6);
    expect(state.entries[1][1]).toBe(6);
    expect(state.notes[1][1]).toEqual([]);
  });

  it("toggles a note on and back off, keeping it sorted", () => {
    const puzzle = samplePuzzle();
    let state = defaultBoardState(puzzle, 9);
    state = toggleNote(state, puzzle, 2, 2, 5);
    state = toggleNote(state, puzzle, 2, 2, 2);
    expect(state.notes[2][2]).toEqual([2, 5]);
    state = toggleNote(state, puzzle, 2, 2, 5);
    expect(state.notes[2][2]).toEqual([2]);
  });

  it("does not add a note to a cell that already holds a final entry", () => {
    const puzzle = samplePuzzle();
    let state = defaultBoardState(puzzle, 9);
    state = setEntry(state, puzzle, 3, 3, 8);
    state = toggleNote(state, puzzle, 3, 3, 1);
    expect(state.notes[3][3]).toEqual([]);
  });

  it("erase clears both the entry and any notes", () => {
    const puzzle = samplePuzzle();
    let state = defaultBoardState(puzzle, 9);
    state = setEntry(state, puzzle, 1, 1, 6);
    state = eraseCell(state, puzzle, 1, 1);
    expect(state.entries[1][1]).toBe(0);
    expect(state.notes[1][1]).toEqual([]);
  });

  it("never mutates the input state (every call returns a new object)", () => {
    const puzzle = samplePuzzle();
    const state = defaultBoardState(puzzle, 9);
    const next = setEntry(state, puzzle, 1, 1, 6);
    expect(state.entries[1][1]).toBe(0);
    expect(next).not.toBe(state);
  });
});

describe("getPeers", () => {
  it("returns every cell sharing the row, column or box, and no others", () => {
    const peers = getPeers(0, 0, SUDOKU);
    // 8 in the row + 8 in the column + 4 more in the box (box already overlaps row/col by 2+2) = 20
    expect(peers.length).toBe(20);
    expect(peers).not.toContainEqual([0, 0]);
    expect(peers).toContainEqual([0, 5]); // same row
    expect(peers).toContainEqual([5, 0]); // same column
    expect(peers).toContainEqual([2, 2]); // same box
    expect(peers).not.toContainEqual([4, 4]); // unrelated
  });
});

describe("findConflicts", () => {
  it("flags a repeated digit in a row, column and box", () => {
    const entries = Array.from({ length: 9 }, () => Array(9).fill(0));
    entries[0][0] = 5;
    entries[0][1] = 5; // row conflict
    expect(findConflicts(entries, SUDOKU)).toEqual(new Set(["0,0", "0,1"]));
  });

  it("is empty once the conflicting duplicate is resolved", () => {
    const entries = Array.from({ length: 9 }, () => Array(9).fill(0));
    entries[0][0] = 5;
    entries[0][1] = 5;
    entries[0][1] = 6;
    expect(findConflicts(entries, SUDOKU).size).toBe(0);
  });
});

describe("isFull / isSolved", () => {
  it("is full only once every cell is non-zero", () => {
    const entries = Array.from({ length: 9 }, () => Array(9).fill(1));
    expect(isFull(entries)).toBe(true);
    entries[4][4] = 0;
    expect(isFull(entries)).toBe(false);
  });

  it("is solved only when every cell matches the solution exactly", () => {
    const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => ((r + c) % 9) + 1));
    const entries = solution.map((row) => row.slice());
    expect(isSolved(entries, solution)).toBe(true);
    entries[0][0] = entries[0][0] === 9 ? 1 : 9;
    expect(isSolved(entries, solution)).toBe(false);
  });
});

describe("getHighlight", () => {
  it("is empty with no selection", () => {
    const entries = samplePuzzle();
    const h = getHighlight(null, entries, SUDOKU);
    expect(h.peers.size).toBe(0);
    expect(h.sameValue.size).toBe(0);
  });

  it("highlights peers and same-value cells of the selected cell", () => {
    const entries = samplePuzzle(); // [0][0]=5, [8][0]=1 shares column with [0][0]
    const h = getHighlight({ row: 0, col: 0 }, entries, SUDOKU);
    expect(h.peers.has("8,0")).toBe(true); // same column
    expect(h.peers.has("4,4")).toBe(false); // unrelated
    expect(h.sameValue.has("0,0")).toBe(true);
  });

  it("has no same-value highlight when the selected cell is empty", () => {
    const entries = samplePuzzle();
    const h = getHighlight({ row: 1, col: 1 }, entries, SUDOKU);
    expect(h.sameValue.size).toBe(0);
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical board", () => {
    const puzzle = samplePuzzle();
    let state = defaultBoardState(puzzle, 9);
    state = setEntry(state, puzzle, 1, 1, 6);
    state = toggleNote(state, puzzle, 2, 2, 3);
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored).toEqual(state);
  });
});
