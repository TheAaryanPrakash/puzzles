import { describe, expect, it } from "vitest";
import { SITE_URL } from "../../config";
import {
  DEFAULT_STATE,
  applyCellInteraction,
  buildSummary,
  canExtend,
  clearPath,
  formatElapsed,
  hasWall,
  isAdjacent,
  isSolved,
  moveInDirection,
  undo,
  visitedCheckpointCount,
  type Cell,
  type ZipPuzzle,
} from "./logic";

/** A 3x3 square puzzle with a known unique boustrophedon Hamiltonian path. */
function makeSquarePuzzle(): ZipPuzzle {
  const solution: Cell[] = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 2 },
    { row: 1, col: 1 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
  ];
  return {
    size: 3,
    checkpoints: [
      { num: 1, row: 0, col: 0 },
      { num: 2, row: 1, col: 0 },
      { num: 3, row: 2, col: 2 },
    ],
    walls: [],
    solution,
  };
}

describe("isAdjacent", () => {
  it("is true only for orthogonal neighbors, never diagonal", () => {
    expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 1, col: 0 })).toBe(true);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 0 })).toBe(false);
  });
});

describe("canExtend — starting the path", () => {
  it("accepts starting at checkpoint 1 from an empty path", () => {
    const puzzle = makeSquarePuzzle();
    expect(canExtend(puzzle, [], { row: 0, col: 0 })).toBe(true);
  });

  it("rejects starting anywhere else", () => {
    const puzzle = makeSquarePuzzle();
    expect(canExtend(puzzle, [], { row: 0, col: 1 })).toBe(false);
    expect(canExtend(puzzle, [], { row: 2, col: 2 })).toBe(false);
  });
});

describe("canExtend — mid-path", () => {
  it("rejects a diagonal step", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [{ row: 0, col: 0 }];
    expect(canExtend(puzzle, path, { row: 1, col: 1 })).toBe(false);
  });

  it("rejects an adjacent checkpoint cell when it is not the next one due", () => {
    // Checkpoint 3 sits right next to checkpoint 1, before checkpoint 2 has been visited.
    const trap: ZipPuzzle = {
      size: 3,
      checkpoints: [
        { num: 1, row: 1, col: 1 },
        { num: 2, row: 2, col: 2 },
        { num: 3, row: 0, col: 1 },
      ],
      walls: [],
      solution: [],
    };
    expect(canExtend(trap, [{ row: 1, col: 1 }], { row: 0, col: 1 })).toBe(false);
  });

  it("accepts an adjacent checkpoint cell when it is the next one due", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [{ row: 0, col: 0 }, { row: 1, col: 0 }];
    expect(canExtend(puzzle, path, { row: 2, col: 0 })).toBe(true);
  });

  it("rejects revisiting an already-visited cell as an extension", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    expect(canExtend(puzzle, path, { row: 0, col: 0 })).toBe(false);
  });

  it("rejects a wall-blocked adjacent cell", () => {
    const puzzle = makeSquarePuzzle();
    const walled: ZipPuzzle = {
      ...puzzle,
      walls: [{ a: { row: 0, col: 0 }, b: { row: 0, col: 1 } }],
    };
    expect(canExtend(walled, [{ row: 0, col: 0 }], { row: 0, col: 1 })).toBe(false);
    expect(canExtend(puzzle, [{ row: 0, col: 0 }], { row: 0, col: 1 })).toBe(true);
  });
});

describe("hasWall", () => {
  it("blocks movement in either direction between the same pair", () => {
    const walls = [{ a: { row: 0, col: 0 }, b: { row: 0, col: 1 } }];
    expect(hasWall(walls, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(hasWall(walls, { row: 0, col: 1 }, { row: 0, col: 0 })).toBe(true);
    expect(hasWall(walls, { row: 1, col: 0 }, { row: 1, col: 1 })).toBe(false);
  });
});

describe("applyCellInteraction", () => {
  it("extends the path on a legal move", () => {
    const puzzle = makeSquarePuzzle();
    const path = applyCellInteraction(puzzle, [], { row: 0, col: 0 });
    expect(path).toEqual([{ row: 0, col: 0 }]);
    const next = applyCellInteraction(puzzle, path, { row: 0, col: 1 });
    expect(next).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  it("retracts to an earlier cell when re-entering the already-drawn path (drag-back)", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
    ];
    const retracted = applyCellInteraction(puzzle, path, { row: 0, col: 1 });
    expect(retracted).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  it("leaves the path unchanged on an illegal cell", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [{ row: 0, col: 0 }];
    const unchanged = applyCellInteraction(puzzle, path, { row: 1, col: 1 }); // diagonal
    expect(unchanged).toBe(path);
  });

  it("leaves the path unchanged on a drag across a wall from the path end", () => {
    const puzzle = makeSquarePuzzle();
    const walled: ZipPuzzle = {
      ...puzzle,
      walls: [{ a: { row: 0, col: 0 }, b: { row: 0, col: 1 } }],
    };
    const path: Cell[] = [{ row: 0, col: 0 }];
    const unchanged = applyCellInteraction(walled, path, { row: 0, col: 1 });
    expect(unchanged).toBe(path);
  });

  it("leaves the path unchanged on a checkpoint visited out of order", () => {
    // Checkpoint 3 sits right next to checkpoint 1, before checkpoint 2 has been visited.
    const trap: ZipPuzzle = {
      size: 3,
      checkpoints: [
        { num: 1, row: 1, col: 1 },
        { num: 2, row: 2, col: 2 },
        { num: 3, row: 0, col: 1 },
      ],
      walls: [],
      solution: [],
    };
    const path: Cell[] = [{ row: 1, col: 1 }];
    const unchanged = applyCellInteraction(trap, path, { row: 0, col: 1 });
    expect(unchanged).toBe(path);
  });

  it("retracts all the way down to a single-cell path when re-entering checkpoint 1 itself", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
    ];
    const retracted = applyCellInteraction(puzzle, path, { row: 0, col: 0 });
    expect(retracted).toEqual([{ row: 0, col: 0 }]);
  });
});

describe("moveInDirection", () => {
  it("starts at checkpoint 1 on the first press, regardless of direction", () => {
    const puzzle = makeSquarePuzzle();
    expect(moveInDirection(puzzle, [], "left")).toEqual([{ row: 0, col: 0 }]);
    expect(moveInDirection(puzzle, [], "down")).toEqual([{ row: 0, col: 0 }]);
  });

  it("moves the path end in the given direction when legal", () => {
    const puzzle = makeSquarePuzzle();
    const path = moveInDirection(puzzle, [{ row: 0, col: 0 }], "right");
    expect(path).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  it("retracts when the direction points back onto the previous cell", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    const back = moveInDirection(puzzle, path, "left");
    expect(back).toEqual([{ row: 0, col: 0 }]);
  });
});

describe("undo / clearPath", () => {
  it("undo removes exactly the last cell", () => {
    const path: Cell[] = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];
    expect(undo(path)).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  it("clearPath empties the path entirely", () => {
    expect(clearPath()).toEqual([]);
  });
});

describe("visitedCheckpointCount", () => {
  it("counts checkpoints present on the path", () => {
    const puzzle = makeSquarePuzzle();
    const path: Cell[] = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];
    expect(visitedCheckpointCount(puzzle, path)).toBe(1); // only checkpoint 1 visited so far
  });
});

describe("isSolved", () => {
  it("requires full coverage AND ending on the highest checkpoint", () => {
    const puzzle = makeSquarePuzzle();
    expect(isSolved(puzzle, puzzle.solution)).toBe(true);

    // Full coverage but ending elsewhere (swap the last two cells) is not solved.
    const last = puzzle.solution[puzzle.solution.length - 1];
    const secondLast = puzzle.solution[puzzle.solution.length - 2];
    const wrongEnding = [...puzzle.solution.slice(0, -2), last, secondLast];
    expect(isSolved(puzzle, wrongEnding)).toBe(false);
  });

  it("is false while the path is incomplete", () => {
    const puzzle = makeSquarePuzzle();
    expect(isSolved(puzzle, puzzle.solution.slice(0, 3))).toBe(false);
  });
});

describe("state round-trips through JSON", () => {
  it("restores byte-identical after JSON.parse(JSON.stringify(...))", () => {
    const state = { path: [{ row: 0, col: 0 }, { row: 0, col: 1 }], elapsed: 42 };
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored).toEqual(state);
  });

  it("DEFAULT_STATE is itself valid, empty JSON", () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_STATE))).toEqual(DEFAULT_STATE);
  });
});

describe("formatElapsed", () => {
  it("formats seconds as m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(59)).toBe("0:59");
    expect(formatElapsed(60)).toBe("1:00");
    expect(formatElapsed(125)).toBe("2:05");
  });
});

describe("buildSummary", () => {
  it("never contains any cell coordinates — only the puzzle number and the time", () => {
    const summary = buildSummary(7, 125);
    expect(summary).toBe(`Zip #7 ⏱ 2:05\n\n${SITE_URL}`);
    expect(summary).not.toMatch(/row|col/i);
  });

  it("does not leak the puzzle's solution regardless of its shape", () => {
    const puzzle = makeSquarePuzzle();
    const summary = buildSummary(1, 10);
    for (const cell of puzzle.solution) {
      const serializedCell = JSON.stringify(cell);
      expect(summary).not.toContain(serializedCell);
    }
  });
});
