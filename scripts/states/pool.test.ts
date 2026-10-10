import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/lib/daily";
import { buildScheduleCodes } from "./pool";

const CODES = ["A", "B", "C", "D", "E"];

describe("buildScheduleCodes", () => {
  it("is deterministic for a given seed", () => {
    const a = buildScheduleCodes(CODES, mulberry32(101), 40);
    const b = buildScheduleCodes(CODES, mulberry32(101), 40);
    expect(a).toEqual(b);
  });

  it("every full-length window is a permutation of all codes (no repeats until used up)", () => {
    const schedule = buildScheduleCodes(CODES, mulberry32(101), CODES.length * 4);
    for (let i = 0; i < schedule.length; i += CODES.length) {
      const window = schedule.slice(i, i + CODES.length);
      expect(new Set(window)).toEqual(new Set(CODES));
    }
  });

  it("returns exactly `count` codes even when count isn't a multiple of the pool size", () => {
    const schedule = buildScheduleCodes(CODES, mulberry32(101), 13);
    expect(schedule).toHaveLength(13);
  });

  it("different seeds produce different orderings", () => {
    const a = buildScheduleCodes(CODES, mulberry32(101), CODES.length);
    const b = buildScheduleCodes(CODES, mulberry32(202), CODES.length);
    expect(a).not.toEqual(b);
  });
});
