import { describe, it, expect } from "vitest";
import {
  advanceAfterType,
  buildSummary,
  cellIndex,
  clueAt,
  cluesAt,
  activeDirections,
  DEFAULT_STATE,
  emptyLetters,
  formatElapsed,
  isBlack,
  isFilled,
  isSolved,
  moveArrow,
  moveToAdjacentClue,
  normalizeLetters,
  resolveTapDirection,
  retreatAfterDelete,
  revealedLetters,
  wordCells,
  wrongCells,
  type MiniPuzzle,
  type MiniState,
} from "./logic";

/**
 * A tiny 3x3 fixture:
 *   C A T
 *   A # #
 *   R # #
 * 1-Across "CAT" and 1-Down "CAR" share (0,0). (0,1)/(0,2) are across-only (their down runs are
 * length 1, so they get no down clue) — exercises the "only one active direction" edge case.
 */
const puzzle: MiniPuzzle = {
  size: 3,
  cells: [
    { answer: "C", number: 1 },
    { answer: "A" },
    { answer: "T" },
    { answer: "A" },
    null,
    null,
    { answer: "R" },
    null,
    null,
  ],
  clues: {
    across: [{ number: 1, row: 0, col: 0, length: 3, answer: "CAT", clue: "Feline", source: "written" }],
    down: [{ number: 1, row: 0, col: 0, length: 3, answer: "CAR", clue: "Vehicle", source: "written" }],
  },
};

describe("isBlack", () => {
  it("is true for black squares and off-grid cells", () => {
    expect(isBlack(puzzle, 1, 1)).toBe(true);
    expect(isBlack(puzzle, -1, 0)).toBe(true);
    expect(isBlack(puzzle, 0, 3)).toBe(true);
  });
  it("is false for white squares", () => {
    expect(isBlack(puzzle, 0, 0)).toBe(false);
  });
});

describe("wordCells / clueAt / cluesAt", () => {
  it("returns the cell indices spanned by a clue", () => {
    expect(wordCells(puzzle, "across", puzzle.clues.across[0])).toEqual([0, 1, 2]);
    expect(wordCells(puzzle, "down", puzzle.clues.down[0])).toEqual([0, 3, 6]);
  });

  it("finds the clue covering a cell in each direction", () => {
    expect(clueAt(puzzle, "across", 0, 1)?.answer).toBe("CAT");
    expect(clueAt(puzzle, "down", 0, 0)?.answer).toBe("CAR");
    expect(clueAt(puzzle, "down", 0, 1)).toBeUndefined(); // (0,1)'s down run is length 1
  });

  it("activeDirections reflects which directions actually have an entry", () => {
    expect(activeDirections(puzzle, 0, 0)).toEqual(["across", "down"]);
    expect(activeDirections(puzzle, 0, 1)).toEqual(["across"]);
  });

  it("cluesAt returns both clues for a cell shared by across and down", () => {
    const clues = cluesAt(puzzle, 0, 0);
    expect(clues.across?.answer).toBe("CAT");
    expect(clues.down?.answer).toBe("CAR");
  });

  it("cluesAt omits a direction with no entry through the cell", () => {
    expect(cluesAt(puzzle, 0, 1).down).toBeUndefined();
  });
});

describe("resolveTapDirection", () => {
  it("picks the only available direction for a single-direction cell", () => {
    expect(resolveTapDirection(puzzle, 0, 1, null)).toBe("across");
    expect(resolveTapDirection(puzzle, 0, 1, { row: 5, col: 5, direction: "down" })).toBe("across");
  });

  it("toggles direction when re-tapping a cell with both directions", () => {
    const current = { row: 0, col: 0, direction: "across" as const };
    expect(resolveTapDirection(puzzle, 0, 0, current)).toBe("down");
  });

  it("keeps the current direction when moving to a new cell that still supports it", () => {
    const current = { row: 5, col: 5, direction: "down" as const };
    expect(resolveTapDirection(puzzle, 0, 0, current)).toBe("down");
  });
});

describe("advanceAfterType", () => {
  it("moves to the next cell in the word", () => {
    const letters = emptyLetters(puzzle);
    expect(advanceAfterType(puzzle, letters, "across", 0, 0)).toEqual({ row: 0, col: 1, direction: "across" });
  });

  it("skips over already-filled cells", () => {
    const letters = emptyLetters(puzzle);
    letters[1] = "A"; // (0,1) already filled
    expect(advanceAfterType(puzzle, letters, "across", 0, 0)).toEqual({ row: 0, col: 2, direction: "across" });
  });

  it("stays put at the end of the word", () => {
    const letters = emptyLetters(puzzle);
    expect(advanceAfterType(puzzle, letters, "across", 0, 2)).toEqual({ row: 0, col: 2, direction: "across" });
  });
});

describe("retreatAfterDelete", () => {
  it("moves one cell back in the current word", () => {
    expect(retreatAfterDelete(puzzle, "across", 0, 2)).toEqual({ row: 0, col: 1, direction: "across" });
  });
  it("stays put at the start of the word", () => {
    expect(retreatAfterDelete(puzzle, "across", 0, 0)).toEqual({ row: 0, col: 0, direction: "across" });
  });
});

describe("moveArrow", () => {
  it("moves one step and keeps direction on the same axis", () => {
    expect(moveArrow(puzzle, 0, 0, "across", "ArrowRight")).toEqual({ row: 0, col: 1, direction: "across" });
  });
  it("switches direction when the key's axis differs from the current direction", () => {
    expect(moveArrow(puzzle, 0, 0, "down", "ArrowRight")).toEqual({ row: 0, col: 1, direction: "across" });
    expect(moveArrow(puzzle, 0, 0, "across", "ArrowDown")).toEqual({ row: 1, col: 0, direction: "down" });
  });
  it("is a no-op onto a black square or off the grid", () => {
    expect(moveArrow(puzzle, 0, 0, "across", "ArrowUp")).toEqual({ row: 0, col: 0, direction: "down" });
    expect(moveArrow(puzzle, 0, 1, "across", "ArrowDown")).toEqual({ row: 0, col: 1, direction: "down" });
  });
});

describe("moveToAdjacentClue", () => {
  it("wraps from the last clue to the first", () => {
    expect(moveToAdjacentClue(puzzle, "down", 1, 1)).toEqual({ row: 0, col: 0, direction: "across" });
  });
  it("wraps backward from the first clue to the last", () => {
    expect(moveToAdjacentClue(puzzle, "across", 1, -1)).toEqual({ row: 0, col: 0, direction: "down" });
  });
});

describe("isFilled / isSolved / revealedLetters / wrongCells", () => {
  it("is not filled or solved when empty", () => {
    const letters = emptyLetters(puzzle);
    expect(isFilled(puzzle, letters)).toBe(false);
    expect(isSolved(puzzle, letters)).toBe(false);
  });

  it("is filled but not solved with wrong letters", () => {
    const letters = ["C", "A", "T", "X", null, null, "X", null, null];
    expect(isFilled(puzzle, letters)).toBe(true);
    expect(isSolved(puzzle, letters)).toBe(false);
    expect(wrongCells(puzzle, letters)).toEqual([3, 6]);
  });

  it("is solved once every letter matches", () => {
    const letters = revealedLetters(puzzle);
    expect(isFilled(puzzle, letters)).toBe(true);
    expect(isSolved(puzzle, letters)).toBe(true);
    expect(wrongCells(puzzle, letters)).toEqual([]);
  });
});

describe("normalizeLetters", () => {
  it("returns an empty, correctly-sized array for undefined or mis-sized input (the {} gotcha)", () => {
    expect(normalizeLetters(undefined, puzzle)).toEqual(emptyLetters(puzzle));
    expect(normalizeLetters(["A"], puzzle)).toEqual(emptyLetters(puzzle));
    expect(normalizeLetters([] as MiniState["letters"], puzzle)).toEqual(emptyLetters(puzzle));
  });

  it("passes through a correctly-sized array unchanged", () => {
    const letters = revealedLetters(puzzle);
    expect(normalizeLetters(letters, puzzle)).toEqual(letters);
  });
});

describe("cellIndex", () => {
  it("is row-major", () => {
    expect(cellIndex(puzzle, 0, 0)).toBe(0);
    expect(cellIndex(puzzle, 1, 0)).toBe(3);
    expect(cellIndex(puzzle, 2, 2)).toBe(8);
  });
});

describe("formatElapsed", () => {
  it("formats seconds as m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(75)).toBe("1:15");
    expect(formatElapsed(3600)).toBe("60:00");
  });
});

describe("buildSummary", () => {
  it("never contains an answer, win or lose", () => {
    const won = buildSummary(puzzle, 12, 83, false);
    expect(won).not.toMatch(/CAT|CAR/i);
    expect(won).toContain("Mini #12");
    expect(won).toContain("1:23");

    const revealed = buildSummary(puzzle, 12, 83, true);
    expect(revealed).not.toMatch(/CAT|CAR/i);
    expect(revealed.toLowerCase()).toContain("peeked");
  });

  it("encodes the grid shape as black/white squares, not letters", () => {
    const summary = buildSummary(puzzle, 1, 10, false);
    const lines = summary.split("\n").slice(2);
    expect(lines).toEqual(["🟩🟩🟩", "🟩⬛⬛", "🟩⬛⬛"]);
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical game", () => {
    const state: MiniState = { letters: ["C", "A", "T", null, null, null, null, null, null], elapsed: 42, revealed: false };
    const restored = JSON.parse(JSON.stringify(state)) as MiniState;
    expect(restored).toEqual(state);
  });

  it("DEFAULT_STATE merges safely over the {} the backend hands back right after start()", () => {
    const fresh = { ...DEFAULT_STATE, ...({} as Partial<MiniState>) };
    expect(normalizeLetters(fresh.letters, puzzle)).toEqual(emptyLetters(puzzle));
    expect(fresh.elapsed).toBe(0);
    expect(fresh.revealed).toBe(false);
  });
});
