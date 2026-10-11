import { describe, it, expect } from "vitest";
import { type BoardConfig, emptyGrid, fillRandomSolution, digHoles, mulberry32 } from "./core";
import { gradeDifficulty } from "./grading";

const SUDOKU: BoardConfig = { size: 9, boxH: 3, boxW: 3 };
const MINI: BoardConfig = { size: 6, boxH: 2, boxW: 3 };

/** Builds the same (solved, puzzle) pair `generate.ts` would for a given seed/clue target. */
function puzzleFor(config: BoardConfig, seed: number, targetClues: number) {
  const solved = emptyGrid(config);
  fillRandomSolution(solved, config, mulberry32(seed * 1000));
  const puzzle = digHoles(solved, config, mulberry32(seed * 1000 + 1), targetClues);
  return { solved, puzzle };
}

describe("gradeDifficulty", () => {
  it("grades a puzzle with a single blank cell as easy (one naked single)", () => {
    const config = SUDOKU;
    const { solved } = puzzleFor(config, 1, 81);
    const puzzle = solved.map((row) => row.slice());
    puzzle[4][4] = 0;
    expect(gradeDifficulty(puzzle, config)).toBe("easy");
  });

  it("grades a fully solved grid as easy (nothing left to deduce)", () => {
    const { solved } = puzzleFor(SUDOKU, 2, 81);
    expect(gradeDifficulty(solved, SUDOKU)).toBe("easy");
  });

  // Seeds below were found by generating many (solved, dug) pairs at a fixed clue target and
  // recording which tier each one actually graded as (see RESEARCH.md) — they pin down one
  // deterministic example of each tier so this test can't be flaky.
  it("grades a generously-clued 9x9 puzzle as easy", () => {
    expect(gradeDifficulty(puzzleFor(SUDOKU, 1, 40).puzzle, SUDOKU)).toBe("easy");
  });

  it("grades a 9x9 puzzle needing locked candidates/pairs as medium", () => {
    expect(gradeDifficulty(puzzleFor(SUDOKU, 4, 26).puzzle, SUDOKU)).toBe("medium");
  });

  it("grades a sparsely-clued 9x9 puzzle needing backtracking as hard", () => {
    expect(gradeDifficulty(puzzleFor(SUDOKU, 7, 22).puzzle, SUDOKU)).toBe("hard");
  });

  it("grades a generously-clued 6x6 puzzle as easy", () => {
    expect(gradeDifficulty(puzzleFor(MINI, 1, 20).puzzle, MINI)).toBe("easy");
  });

  it("grades a sparsely-clued 6x6 puzzle needing pairs as medium", () => {
    expect(gradeDifficulty(puzzleFor(MINI, 4, 9).puzzle, MINI)).toBe("medium");
  });

  it("never grades easier than warranted: more clues never grades harder than fewer clues from the same solution", () => {
    const { solved } = puzzleFor(SUDOKU, 10, 81);
    const rank = { easy: 0, medium: 1, hard: 2 };
    const generous = digHoles(solved, SUDOKU, mulberry32(10001), 50);
    const sparse = digHoles(solved, SUDOKU, mulberry32(10001), 24);
    expect(rank[gradeDifficulty(generous, SUDOKU)]).toBeLessThanOrEqual(rank[gradeDifficulty(sparse, SUDOKU)]);
  });
});
