import { describe, it, expect } from "vitest";
import {
  evalOp,
  applyStep,
  poolAfterSteps,
  starsFor,
  scoreRound,
  totalStars,
  isWon,
  isGameOver,
  addStep,
  undoStep,
  resetRound,
  submitRound,
  minStepsTo,
  reachableInOneStep,
  buildSummary,
  DEFAULT_STATE,
  ROUNDS_PER_DAY,
  type DigitsPuzzle,
  type DigitsState,
  type DigitsRound,
  type RoundState,
  type Step,
} from "./logic";

function round(numbers: number[], target: number, minSteps: number): DigitsRound {
  return { numbers, target, minSteps };
}

function freshRoundState(): RoundState {
  return { steps: [], submitted: false };
}

function freshState(): DigitsState {
  return JSON.parse(JSON.stringify(DEFAULT_STATE)) as DigitsState;
}

describe("evalOp", () => {
  it("adds and multiplies freely", () => {
    expect(evalOp(3, 4, "+")).toBe(7);
    expect(evalOp(3, 4, "*")).toBe(12);
  });

  it("rejects subtraction that would go to zero or negative", () => {
    expect(evalOp(4, 4, "-")).toBeUndefined();
    expect(evalOp(3, 4, "-")).toBeUndefined();
    expect(evalOp(4, 3, "-")).toBe(1);
  });

  it("rejects division that isn't exact, and division by zero", () => {
    expect(evalOp(10, 3, "/")).toBeUndefined();
    expect(evalOp(10, 0, "/")).toBeUndefined();
    expect(evalOp(10, 5, "/")).toBe(2);
  });
});

describe("applyStep / poolAfterSteps", () => {
  it("applies a legal step and removes exactly the two operands used", () => {
    const pool = [2, 3, 5, 10, 15, 25];
    const next = applyStep(pool, { a: 10, b: 15, op: "+", result: 25 });
    expect(next).toEqual([2, 3, 5, 25, 25]);
  });

  it("rejects a step whose declared result doesn't match the operation", () => {
    expect(applyStep([2, 3], { a: 2, b: 3, op: "+", result: 6 })).toBeUndefined();
  });

  it("rejects operands not present in the pool", () => {
    expect(applyStep([2, 3, 5], { a: 10, b: 2, op: "+", result: 12 })).toBeUndefined();
  });

  it("removes only one instance of a duplicated value, not both", () => {
    const pool = [5, 5, 3];
    const next = applyStep(pool, { a: 5, b: 3, op: "+", result: 8 });
    expect(next).toEqual([5, 8]);
  });

  it("replays a chain of steps to the final pool", () => {
    const numbers = [2, 3, 5, 10, 15, 25];
    const steps: Step[] = [
      { a: 10, b: 15, op: "+", result: 25 },
      { a: 25, b: 25, op: "+", result: 50 },
    ];
    expect(poolAfterSteps(numbers, steps)).toEqual([2, 3, 5, 50]);
  });

  it("stops and returns undefined if any step in the chain is illegal", () => {
    const numbers = [2, 3];
    const steps: Step[] = [{ a: 2, b: 3, op: "-", result: -1 }]; // negative: illegal
    expect(poolAfterSteps(numbers, steps)).toBeUndefined();
  });
});

describe("starsFor / scoreRound", () => {
  it("awards stars at the documented boundaries", () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(10)).toBe(2);
    expect(starsFor(11)).toBe(1);
    expect(starsFor(25)).toBe(1);
    expect(starsFor(26)).toBe(0);
  });

  it("scores from the original numbers alone when no steps were taken", () => {
    const r = round([1, 2, 3, 100, 200, 300], 300, 2);
    const score = scoreRound(r, freshRoundState());
    expect(score.closest).toBe(300);
    expect(score.stars).toBe(3);
  });

  it("scores using the closest number on the board after steps", () => {
    const r = round([2, 3, 5, 10, 15, 25], 195, 2);
    const state: RoundState = {
      steps: [
        { a: 15, b: 10, op: "+", result: 25 }, // pool: 2,3,5,25,25
        { a: 25, b: 25, op: "*", result: 625 }, // pool: 2,3,5,625 -- intentionally overshoots
      ],
      submitted: false,
    };
    // closest to 195 among [2,3,5,625] is 625, diff 430 -> 0 stars
    expect(scoreRound(r, state).stars).toBe(0);
  });
});

describe("addStep / undoStep / resetRound / submitRound", () => {
  const r = round([2, 3, 5, 10, 15, 25], 50, 2);
  const step: Step = { a: 10, b: 15, op: "+", result: 25 };

  it("adds, undoes and resets a round's steps", () => {
    let state = freshState();
    state = addStep(state, 0, step);
    expect(state.rounds[0].steps).toEqual([step]);
    state = undoStep(state, 0);
    expect(state.rounds[0].steps).toEqual([]);

    state = addStep(state, 0, step);
    state = resetRound(state, 0);
    expect(state.rounds[0].steps).toEqual([]);
  });

  it("locks a round on submit, rejecting further add/undo/reset", () => {
    let state = freshState();
    state = addStep(state, 0, step);
    state = submitRound(state, 0);
    expect(state.rounds[0].submitted).toBe(true);

    const afterAdd = addStep(state, 0, { a: 25, b: 2, op: "+", result: 27 });
    expect(afterAdd.rounds[0].steps).toEqual([step]); // unchanged

    const afterUndo = undoStep(state, 0);
    expect(afterUndo.rounds[0].steps).toEqual([step]); // unchanged

    const afterReset = resetRound(state, 0);
    expect(afterReset.rounds[0].steps).toEqual([step]); // unchanged
  });

  it("undo is a no-op with no steps to undo", () => {
    const state = freshState();
    expect(undoStep(state, 0)).toBe(state);
  });

  void r; // used only for documentation above
});

describe("isWon / isGameOver / totalStars", () => {
  function puzzleOf(n: number): DigitsPuzzle {
    return { rounds: Array.from({ length: n }, (_, i) => round([1, 2, 3, 4, 5, 6], 10 + i, 2)) };
  }

  it("is not won until every round is submitted with at least 1 star", () => {
    const puzzle = puzzleOf(ROUNDS_PER_DAY);
    let state = freshState();
    expect(isWon(puzzle, state)).toBe(false);
    expect(isGameOver(state)).toBe(false);

    for (let i = 0; i < ROUNDS_PER_DAY; i++) {
      // closest number is 1 (diff from 10..14 is >= 9); use round 0's target=10, diff=9 -> 2 stars
      state = submitRound(state, i);
    }
    expect(isGameOver(state)).toBe(true);
    expect(isWon(puzzle, state)).toBe(true);
    expect(totalStars(puzzle, state)).toBeGreaterThan(0);
  });

  it("is lost if any submitted round scores 0 stars", () => {
    const puzzle: DigitsPuzzle = {
      rounds: [
        round([1, 2, 3, 4, 5, 6], 1000, 2), // unreachable closeness -> 0 stars from bare numbers
        ...Array.from({ length: ROUNDS_PER_DAY - 1 }, () => round([1, 2, 3, 4, 5, 6], 6, 2)),
      ],
    };
    let state = freshState();
    for (let i = 0; i < ROUNDS_PER_DAY; i++) state = submitRound(state, i);
    expect(isWon(puzzle, state)).toBe(false);
  });

  it("is not won if a round is unsubmitted, even with a winning score sitting on the board", () => {
    const puzzle = puzzleOf(ROUNDS_PER_DAY);
    let state = freshState();
    for (let i = 0; i < ROUNDS_PER_DAY - 1; i++) state = submitRound(state, i);
    expect(isGameOver(state)).toBe(false);
    expect(isWon(puzzle, state)).toBe(false);
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical game", () => {
    let state = freshState();
    state = addStep(state, 2, { a: 2, b: 3, op: "+", result: 5 });
    state = submitRound(state, 0);
    const restored = JSON.parse(JSON.stringify(state)) as DigitsState;
    expect(restored).toEqual(state);
  });
});

describe("minStepsTo / reachableInOneStep (solver)", () => {
  it("finds the minimum number of merges for a target that needs real combination", () => {
    // 195 is a captured real NYT Digits target for exactly this number set (see RESEARCH.md);
    // verified (via this same solver) to need 2 merges and not be reachable in 1.
    const numbers = [2, 3, 5, 10, 15, 25];
    expect(minStepsTo(numbers, 195)).toBe(2);
    expect(reachableInOneStep(numbers, 195)).toBe(false);
  });

  it("reports undefined for a target that cannot be built at all", () => {
    const numbers = [1, 1, 1, 1, 1, 1];
    // Six 1s combined via any binary tree of +,-,*,/ (division only ever gives back 1, since
    // every intermediate is built from 1s) tops out at single digits — 999 is far out of reach.
    expect(minStepsTo(numbers, 999)).toBeUndefined();
  });

  it("finds a 1-step solution directly", () => {
    expect(minStepsTo([2, 3, 5, 10, 15, 25], 30)).toBe(1); // 2*15=30
    expect(reachableInOneStep([2, 3, 5, 10, 15, 25], 30)).toBe(true);
  });

  it("returns 0 steps when the target is already sitting among the raw numbers", () => {
    // Not a "solution" in the puzzle sense — the generator separately rejects targets that equal
    // one of the starting numbers (see RESEARCH.md); the solver itself just reports the fact.
    expect(minStepsTo([2, 3, 5, 10, 15, 25], 5)).toBe(0);
  });
});

describe("buildSummary", () => {
  it("never reveals an operator, the target, a starting number, or any intermediate result", () => {
    // Distinctive, non-overlapping values so none can coincidentally appear inside the fixed
    // "#<n> <stars>/15 stars" scaffolding text (e.g. a number like "1" or "5" would too easily —
    // and meaninglessly — "match" part of that denominator).
    const puzzle: DigitsPuzzle = { rounds: [round([37, 41, 53, 62, 71, 84], 329, 2)] };
    let state = freshState();
    state = addStep(state, 0, { a: 71, b: 62, op: "+", result: 133 });
    state = submitRound(state, 0);
    const summary = buildSummary(puzzle, state, 7);

    for (const n of [...puzzle.rounds[0].numbers, puzzle.rounds[0].target, 133]) {
      expect(summary).not.toContain(String(n));
    }
    // "/" itself is expected, as the fixed "x/15 stars" score fraction — not a spoiler.
    for (const op of ["+", "-", "*"]) expect(summary).not.toContain(op);
  });

  it("shows a blank glyph for an unsubmitted round and the total star count", () => {
    const puzzle: DigitsPuzzle = {
      rounds: Array.from({ length: ROUNDS_PER_DAY }, () => round([1, 2, 3, 4, 5, 100], 100, 2)),
    };
    let state = freshState();
    state = submitRound(state, 0); // closest=100, exact -> 3 stars
    const summary = buildSummary(puzzle, state, 1);
    expect(summary).toContain("Digits #1");
    expect(summary).toContain(`3/${ROUNDS_PER_DAY * 3} stars`);
    expect(summary.split("\n")[1].trim().startsWith("⭐⭐⭐")).toBe(true);
  });
});
