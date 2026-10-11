import { describe, it, expect } from "vitest";
import { assignDays } from "./pool";

describe("assignDays", () => {
  it("is deterministic for the same seed", () => {
    const codes = ["US", "IN", "FR", "BR", "JP"];
    expect(assignDays(codes, 12, 61)).toEqual(assignDays(codes, 12, 61));
  });

  it("differs for a different seed", () => {
    const codes = ["US", "IN", "FR", "BR", "JP"];
    expect(assignDays(codes, 12, 61)).not.toEqual(assignDays(codes, 12, 7));
  });

  it("uses every code exactly once before any repeats", () => {
    const codes = ["US", "IN", "FR", "BR", "JP"];
    const assigned = assignDays(codes, codes.length, 61);
    expect(new Set(assigned).size).toBe(codes.length);
  });

  it("only repeats a code after the full pool has been used", () => {
    const codes = ["US", "IN", "FR", "BR", "JP"];
    const assigned = assignDays(codes, codes.length * 3, 61);
    const cycle1 = assigned.slice(0, codes.length);
    const cycle2 = assigned.slice(codes.length, codes.length * 2);
    const cycle3 = assigned.slice(codes.length * 2);
    for (const cycle of [cycle1, cycle2, cycle3]) {
      expect(new Set(cycle).size).toBe(codes.length);
    }
  });

  it("returns exactly numDays entries, truncating a partial final cycle", () => {
    const codes = ["US", "IN", "FR", "BR", "JP"];
    expect(assignDays(codes, 7, 61)).toHaveLength(7);
    expect(assignDays(codes, 1, 61)).toHaveLength(1);
  });

  it("throws on an empty pool", () => {
    expect(() => assignDays([], 5, 61)).toThrow();
  });
});
