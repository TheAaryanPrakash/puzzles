import { describe, it, expect } from "vitest";
import { weekdayDifficulty, generateDay, SUDOKU_CONFIG, BASE_SEED } from "./generate";
import { countSolutions, clueCount } from "./core";

describe("weekdayDifficulty", () => {
  // Dates chosen so `new Date(date + "T00:00:00Z").getUTCDay()` lands on each weekday exactly.
  const CASES: [string, string, ReturnType<typeof weekdayDifficulty>][] = [
    ["Mon", "2026-10-19", "easy"],
    ["Tue", "2026-10-20", "easy"],
    ["Wed", "2026-10-21", "medium"],
    ["Thu", "2026-10-22", "medium"],
    ["Fri", "2026-10-23", "hard"],
    ["Sat", "2026-10-24", "hard"],
    ["Sun", "2026-10-25", "medium"],
  ];

  it.each(CASES)("%s -> %s", (_label, date, expected) => {
    expect(weekdayDifficulty(date)).toBe(expected);
  });
});

describe("generateDay", () => {
  it("produces a unique-solution puzzle graded at (or closest to) the target difficulty", () => {
    for (const [date, target] of [
      ["2026-10-19", "easy"],
      ["2026-10-21", "medium"],
      ["2026-10-23", "hard"],
    ] as const) {
      const day = generateDay(date, target, SUDOKU_CONFIG, BASE_SEED);
      expect(countSolutions(day.puzzle, SUDOKU_CONFIG, 2)).toBe(1);
      expect(clueCount(day.puzzle)).toBeGreaterThan(16); // never below the known 9x9 minimum
      expect(day.difficulty).toBe(target); // all three dates are expected to hit an exact match
    }
  });

  it("is fully deterministic for the same date", () => {
    const a = generateDay("2026-11-01", "medium", SUDOKU_CONFIG, BASE_SEED);
    const b = generateDay("2026-11-01", "medium", SUDOKU_CONFIG, BASE_SEED);
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.solution).toEqual(b.solution);
  });
});
