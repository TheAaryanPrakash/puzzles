import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../src/lib/daily";
import { isAdjacent } from "../../src/games/zip/logic";
import {
  buildHamiltonianPath,
  countSolutions,
  findSolutions,
  growCheckpoints,
  pickDifferingEdge,
  selectCheckpoints,
} from "./hamiltonian";
import type { Cell, Checkpoint } from "../../src/games/zip/logic";

function assertValidHamiltonianPath(path: Cell[] | null, size: number) {
  expect(path).not.toBeNull();
  const p = path!;
  expect(p.length).toBe(size * size);

  const seen = new Set<string>();
  for (const cell of p) {
    expect(cell.row).toBeGreaterThanOrEqual(0);
    expect(cell.row).toBeLessThan(size);
    expect(cell.col).toBeGreaterThanOrEqual(0);
    expect(cell.col).toBeLessThan(size);
    const key = `${cell.row},${cell.col}`;
    expect(seen.has(key)).toBe(false); // every cell visited exactly once
    seen.add(key);
  }
  expect(seen.size).toBe(size * size);

  for (let i = 1; i < p.length; i++) {
    expect(isAdjacent(p[i - 1], p[i])).toBe(true); // every step is orthogonally adjacent
  }
}

describe("buildHamiltonianPath", () => {
  it.each([6, 7, 8])("builds a full, valid, non-repeating path on a %i×%i grid", (size) => {
    const rng = mulberry32(51 + size);
    const path = buildHamiltonianPath(rng, size);
    assertValidHamiltonianPath(path, size);
  });

  it("produces different paths for different rng streams", () => {
    const a = buildHamiltonianPath(mulberry32(1), 6);
    const b = buildHamiltonianPath(mulberry32(2), 6);
    expect(a).not.toEqual(b);
  });
});

function endpointsOnlyCheckpoints(path: Cell[]): Checkpoint[] {
  return [
    { num: 1, row: path[0].row, col: path[0].col },
    { num: 2, row: path[path.length - 1].row, col: path[path.length - 1].col },
  ];
}

describe("countSolutions", () => {
  it("finds exactly one solution for a fully-numbered path (every cell a checkpoint)", () => {
    const size = 4;
    const path = buildHamiltonianPath(mulberry32(42), size)!;
    const checkpoints: Checkpoint[] = path.map((c, i) => ({ num: i + 1, row: c.row, col: c.col }));
    const { count } = countSolutions(size, checkpoints, [], 2, 100_000);
    expect(count).toBe(1);
  });

  it("finds more than one solution for a 3x3 grid with only opposite corners as checkpoints", () => {
    // A known combinatorial fact about the 3x3 grid graph: there are exactly 2 Hamiltonian paths
    // between opposite corners, so capping at 2 should hit the cap.
    const checkpoints: Checkpoint[] = [
      { num: 1, row: 0, col: 0 },
      { num: 2, row: 2, col: 2 },
    ];
    const { count } = countSolutions(3, checkpoints, [], 2, 200_000);
    expect(count).toBe(2);
  });

  it("a wall can cut a non-unique board down to exactly one solution", () => {
    // A real generated 4x4 path with only its endpoints as checkpoints has 4 Hamiltonian paths
    // between them; one specific chord wall (found by probing, not on the true path) cuts it to 1.
    const size = 4;
    const path = buildHamiltonianPath(mulberry32(5), size)!;
    const checkpoints: Checkpoint[] = [
      { num: 1, row: path[0].row, col: path[0].col },
      { num: 2, row: path[path.length - 1].row, col: path[path.length - 1].col },
    ];
    const withoutWall = countSolutions(size, checkpoints, [], 5, 300_000);
    expect(withoutWall.count).toBe(4);

    const walls = [{ a: { row: 1, col: 0 }, b: { row: 2, col: 0 } }];
    const withWall = countSolutions(size, checkpoints, walls, 2, 300_000);
    expect(withWall.count).toBe(1);
  });

  it("finds zero solutions when walls cut off the start cell entirely", () => {
    const size = 2;
    const checkpoints: Checkpoint[] = [
      { num: 1, row: 0, col: 0 },
      { num: 2, row: 1, col: 1 },
    ];
    // Both of (0,0)'s only two neighbors are walled off — the path can never even begin.
    const walls = [
      { a: { row: 0, col: 0 }, b: { row: 0, col: 1 } },
      { a: { row: 0, col: 0 }, b: { row: 1, col: 0 } },
    ];
    const { count } = countSolutions(size, checkpoints, walls, 2, 10_000);
    expect(count).toBe(0);
  });
});

describe("selectCheckpoints", () => {
  it("always includes the first and last path cell", () => {
    const path = buildHamiltonianPath(mulberry32(7), 6)!;
    const checkpoints = selectCheckpoints(path, 6, mulberry32(8));
    expect(checkpoints[0]).toMatchObject({ num: 1, row: path[0].row, col: path[0].col });
    expect(checkpoints[checkpoints.length - 1]).toMatchObject({
      num: checkpoints.length,
      row: path[path.length - 1].row,
      col: path[path.length - 1].col,
    });
  });

  it("returns checkpoints in increasing path order with distinct numbers", () => {
    const path = buildHamiltonianPath(mulberry32(9), 7)!;
    const checkpoints = selectCheckpoints(path, 8, mulberry32(10));
    const nums = checkpoints.map((c) => c.num);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(new Set(nums).size).toBe(nums.length);
  });
});

describe("growCheckpoints", () => {
  it("adds exactly one checkpoint, at the largest gap", () => {
    const path = buildHamiltonianPath(mulberry32(11), 6)!;
    const checkpoints = endpointsOnlyCheckpoints(path);
    const grown = growCheckpoints(path, checkpoints);
    expect(grown.length).toBe(checkpoints.length + 1);
    // still starts/ends at the same cells, renumbered consecutively
    expect(grown[0]).toMatchObject({ num: 1, row: path[0].row, col: path[0].col });
    expect(grown[grown.length - 1]).toMatchObject({
      num: grown.length,
      row: path[path.length - 1].row,
      col: path[path.length - 1].col,
    });
  });
});

describe("pickDifferingEdge", () => {
  it("picks an edge the alternate solution uses that the true solution never does", () => {
    const size = 4;
    const path = buildHamiltonianPath(mulberry32(5), size)!;
    const checkpoints: Checkpoint[] = [
      { num: 1, row: path[0].row, col: path[0].col },
      { num: 2, row: path[path.length - 1].row, col: path[path.length - 1].col },
    ];
    const { solutions } = findSolutions(size, checkpoints, [], 3, 200_000);
    const alt = solutions.find((s) => !pathsEqual(s, path))!;
    expect(alt).toBeDefined();

    const wall = pickDifferingEdge(alt, path, []);
    expect(wall).not.toBeNull();

    // The wall must actually eliminate this alternate: it steps across it...
    const usedByAlt = alt.some(
      (c, i) =>
        i < alt.length - 1 &&
        ((cellEq(c, wall!.a) && cellEq(alt[i + 1], wall!.b)) ||
          (cellEq(c, wall!.b) && cellEq(alt[i + 1], wall!.a))),
    );
    expect(usedByAlt).toBe(true);
    // ...but the true solution never steps across it, so it can never block the true solution.
    const usedByTruth = path.some(
      (c, i) =>
        i < path.length - 1 &&
        ((cellEq(c, wall!.a) && cellEq(path[i + 1], wall!.b)) ||
          (cellEq(c, wall!.b) && cellEq(path[i + 1], wall!.a))),
    );
    expect(usedByTruth).toBe(false);
  });

  it("returns null when the only solution given is the true one (nothing to eliminate)", () => {
    const path: Cell[] = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    expect(pickDifferingEdge(path, path, [])).toBeNull();
  });
});

function cellEq(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function pathsEqual(a: Cell[], b: Cell[]): boolean {
  return a.length === b.length && a.every((c, i) => cellEq(c, b[i]));
}
