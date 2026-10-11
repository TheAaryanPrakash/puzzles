import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../src/lib/daily";
import { isAdjacent } from "../../src/games/zip/logic";
import { countSolutions } from "./hamiltonian";
import { generateDay } from "./generate";

describe("generateDay", () => {
  it.each([6, 7, 8])("produces a %i×%i puzzle with exactly one solution", (size) => {
    const rng = mulberry32(51);
    const puzzle = generateDay(rng, size);

    expect(puzzle.size).toBe(size);
    expect(puzzle.solution.length).toBe(size * size);

    // The solution is itself a valid, full-coverage, non-repeating, orthogonally-adjacent path.
    const seen = new Set<string>();
    for (const cell of puzzle.solution) seen.add(`${cell.row},${cell.col}`);
    expect(seen.size).toBe(size * size);
    for (let i = 1; i < puzzle.solution.length; i++) {
      expect(isAdjacent(puzzle.solution[i - 1], puzzle.solution[i])).toBe(true);
    }

    // Checkpoints start/end the solution and are numbered consecutively from 1.
    expect(puzzle.checkpoints[0]).toMatchObject({
      num: 1,
      row: puzzle.solution[0].row,
      col: puzzle.solution[0].col,
    });
    const lastSolutionCell = puzzle.solution[puzzle.solution.length - 1];
    const lastCheckpoint = puzzle.checkpoints[puzzle.checkpoints.length - 1];
    expect(lastCheckpoint).toMatchObject({
      num: puzzle.checkpoints.length,
      row: lastSolutionCell.row,
      col: lastSolutionCell.col,
    });

    // No wall sits on an edge the solution itself crosses.
    for (const wall of puzzle.walls) {
      const usesEdge = puzzle.solution.some(
        (c, i) =>
          i < puzzle.solution.length - 1 &&
          ((c.row === wall.a.row && c.col === wall.a.col &&
            puzzle.solution[i + 1].row === wall.b.row && puzzle.solution[i + 1].col === wall.b.col) ||
            (c.row === wall.b.row && c.col === wall.b.col &&
              puzzle.solution[i + 1].row === wall.a.row && puzzle.solution[i + 1].col === wall.a.col)),
      );
      expect(usesEdge).toBe(false);
    }

    // The generator's own acceptance test: re-proving uniqueness independently.
    const { count } = countSolutions(size, puzzle.checkpoints, puzzle.walls, 2, 2_000_000);
    expect(count).toBe(1);
  });

  it("is deterministic: the same rng stream in, the same puzzle out", () => {
    const puzzleA = generateDay(mulberry32(51), 6);
    const puzzleB = generateDay(mulberry32(51), 6);
    expect(puzzleA).toEqual(puzzleB);
  });
});
