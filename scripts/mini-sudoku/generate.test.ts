import { describe, it, expect } from "vitest";
import { weekdayDifficulty, generateDay, MINI_CONFIG, BASE_SEED } from "./generate";
import { countSolutions, clueCount } from "../sudoku/core";
import { gradeDifficulty } from "../sudoku/grading";

describe("weekdayDifficulty", () => {
  const CASES: [string, string, ReturnType<typeof weekdayDifficulty>][] = [
    ["Mon", "2026-10-19", "easy"],
    ["Tue", "2026-10-20", "easy"],
    ["Wed", "2026-10-21", "easy"],
    ["Thu", "2026-10-22", "easy"],
    ["Fri", "2026-10-23", "medium"],
    ["Sat", "2026-10-24", "medium"],
    ["Sun", "2026-10-25", "medium"],
  ];

  it.each(CASES)("%s -> %s", (_label, date, expected) => {
    expect(weekdayDifficulty(date)).toBe(expected);
  });
});

describe("generateDay", () => {
  it("produces a unique-solution puzzle that never needs backtracking to grade", () => {
    for (const [date, target] of [
      ["2026-10-19", "easy"],
      ["2026-10-23", "medium"],
    ] as const) {
      const day = generateDay(date, target, MINI_CONFIG, BASE_SEED);
      expect(countSolutions(day.puzzle, MINI_CONFIG, 2)).toBe(1);
      expect(day.difficulty).toBe(target);
      expect(gradeDifficulty(day.puzzle, MINI_CONFIG)).not.toBe("hard");
    }
  });

  it("gives medium days fewer clues than easy days", () => {
    const easy = generateDay("2026-10-19", "easy", MINI_CONFIG, BASE_SEED);
    const medium = generateDay("2026-10-23", "medium", MINI_CONFIG, BASE_SEED);
    expect(clueCount(medium.puzzle)).toBeLessThan(clueCount(easy.puzzle));
  });

  it("is fully deterministic for the same date", () => {
    const a = generateDay("2026-11-01", "medium", MINI_CONFIG, BASE_SEED);
    const b = generateDay("2026-11-01", "medium", MINI_CONFIG, BASE_SEED);
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.solution).toEqual(b.solution);
  });
});
