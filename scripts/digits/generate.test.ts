import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/lib/daily";
import { minStepsTo, reachableInOneStep, ROUNDS_PER_DAY } from "../../src/games/digits/logic";
import { generateRound, generateDay, hashString, targetRange, SEED } from "./generate";

describe("generateRound", () => {
  it("produces a round that is exactly solvable and not solvable in 1 step", () => {
    const rng = mulberry32(hashString(`digits:${SEED}:2026-10-17:0`));
    const round = generateRound(rng, 0);
    expect(round.numbers).toHaveLength(6);
    expect(round.numbers.includes(round.target)).toBe(false);

    // Re-verify independently through the solver (the task's "brute-force solver confirms
    // each target is exactly reachable and not reachable in one step" requirement).
    expect(minStepsTo(round.numbers, round.target)).toBe(round.minSteps);
    expect(round.minSteps).toBeGreaterThanOrEqual(2);
    expect(reachableInOneStep(round.numbers, round.target)).toBe(false);
  });

  it("every number is within the 1-25 pool", () => {
    const rng = mulberry32(hashString(`digits:${SEED}:2026-11-01:3`));
    const round = generateRound(rng, 3);
    for (const n of round.numbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(25);
    }
  });

  it("widens the target range with the round index", () => {
    const [lo0, hi0] = targetRange(0);
    const [lo4, hi4] = targetRange(4);
    expect(lo4).toBeGreaterThan(lo0);
    expect(hi4).toBeGreaterThan(hi0);
  });
});

describe("generateDay", () => {
  it("produces exactly ROUNDS_PER_DAY valid rounds", () => {
    const puzzle = generateDay("2026-10-17");
    expect(puzzle.rounds).toHaveLength(ROUNDS_PER_DAY);
    for (const round of puzzle.rounds) {
      expect(minStepsTo(round.numbers, round.target)).toBe(round.minSteps);
      expect(round.minSteps).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic for the same date", () => {
    const a = generateDay("2026-12-25");
    const b = generateDay("2026-12-25");
    expect(a).toEqual(b);
  });

  it("differs across days (not literally identical puzzles every day)", () => {
    const a = generateDay("2026-10-17");
    const b = generateDay("2026-10-18");
    expect(a).not.toEqual(b);
  });
});

describe("hashString", () => {
  it("is deterministic and varies with its input", () => {
    expect(hashString("digits:21:2026-10-17:0")).toBe(hashString("digits:21:2026-10-17:0"));
    expect(hashString("digits:21:2026-10-17:0")).not.toBe(hashString("digits:21:2026-10-17:1"));
  });
});
