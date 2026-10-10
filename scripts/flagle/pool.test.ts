import { describe, it, expect } from "vitest";
import { EXCLUDED_UNINHABITED, excludeUninhabited, scheduleCountries } from "./pool";

const POOL = Array.from({ length: 10 }, (_, i) => `C${i}`);

describe("scheduleCountries", () => {
  it("throws on an empty pool", () => {
    expect(() => scheduleCountries([], 71, 5)).toThrow();
  });

  it("returns exactly `days` entries", () => {
    expect(scheduleCountries(POOL, 71, 23).length).toBe(23);
  });

  it("is deterministic for the same seed and pool", () => {
    const a = scheduleCountries(POOL, 71, 40);
    const b = scheduleCountries(POOL, 71, 40);
    expect(a).toEqual(b);
  });

  it("differs for a different seed", () => {
    const a = scheduleCountries(POOL, 71, 40);
    const b = scheduleCountries(POOL, 72, 40);
    expect(a).not.toEqual(b);
  });

  it("has no repeats within one shuffle cycle (days <= pool size)", () => {
    const schedule = scheduleCountries(POOL, 71, POOL.length);
    expect(new Set(schedule).size).toBe(POOL.length);
  });

  it("never repeats the same country on two consecutive days, even across a cycle boundary", () => {
    // Schedule well past several cycle boundaries (pool of 10, 47 days = 4 full cycles + partial).
    const schedule = scheduleCountries(POOL, 71, 47);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i]).not.toBe(schedule[i - 1]);
    }
  });

  it("every day's country is drawn from the pool", () => {
    const schedule = scheduleCountries(POOL, 71, 100);
    for (const country of schedule) expect(POOL).toContain(country);
  });

  it("uses every pool country at least once when days > pool size", () => {
    const schedule = scheduleCountries(POOL, 71, 100);
    expect(new Set(schedule).size).toBe(POOL.length);
  });
});

describe("excludeUninhabited", () => {
  it("drops every known uninhabited code and nothing else", () => {
    const withUninhabited = [...POOL, ...EXCLUDED_UNINHABITED];
    const filtered = excludeUninhabited(withUninhabited);
    expect(filtered).toEqual(POOL);
    for (const code of EXCLUDED_UNINHABITED) expect(filtered).not.toContain(code);
  });

  it("is a no-op on a pool with none of the excluded codes", () => {
    expect(excludeUninhabited(POOL)).toEqual(POOL);
  });
});
