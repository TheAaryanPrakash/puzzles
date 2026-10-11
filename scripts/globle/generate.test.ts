import { describe, expect, it } from "vitest";
import { answerPool, buildSchedule, EXCLUDED_FROM_ANSWERS, SEED } from "./generate";

describe("answerPool", () => {
  it("drops every excluded code and keeps everything else, in order", () => {
    const codes = ["FR", "AQ", "DE", "GU", "IN"];
    expect(answerPool(codes)).toEqual(["FR", "DE", "IN"]);
  });

  it("every excluded code is a plausible ISO-2 (2 uppercase letters), with no duplicates", () => {
    for (const code of EXCLUDED_FROM_ANSWERS) expect(code).toMatch(/^[A-Z]{2}$/);
    expect(new Set(EXCLUDED_FROM_ANSWERS).size).toBe(EXCLUDED_FROM_ANSWERS.length);
  });
});

describe("buildSchedule", () => {
  const pool = ["FR", "DE", "IN", "BR", "JP"];

  it("produces exactly `days` codes, all drawn from the pool", () => {
    const schedule = buildSchedule(pool, 12, SEED);
    expect(schedule).toHaveLength(12);
    for (const code of schedule) expect(pool).toContain(code);
  });

  it("never repeats a code within one lap through the pool", () => {
    const schedule = buildSchedule(pool, pool.length, SEED);
    expect(new Set(schedule).size).toBe(pool.length);
  });

  it("covers the whole pool exactly once per lap, even across multiple laps", () => {
    const days = pool.length * 3;
    const schedule = buildSchedule(pool, days, SEED);
    for (let lap = 0; lap < 3; lap++) {
      const slice = schedule.slice(lap * pool.length, (lap + 1) * pool.length);
      expect(new Set(slice).size).toBe(pool.length);
    }
  });

  it("is deterministic: the same seed and pool always produce the same schedule", () => {
    expect(buildSchedule(pool, 20, SEED)).toEqual(buildSchedule(pool, 20, SEED));
  });

  it("a different seed produces a different order", () => {
    expect(buildSchedule(pool, pool.length, SEED)).not.toEqual(
      buildSchedule(pool, pool.length, SEED + 1),
    );
  });

  it("throws on an empty pool rather than looping forever", () => {
    expect(() => buildSchedule([], 5, SEED)).toThrow();
  });

  it("handles a schedule shorter than the pool", () => {
    const schedule = buildSchedule(pool, 2, SEED);
    expect(schedule).toHaveLength(2);
    expect(new Set(schedule).size).toBe(2);
  });
});
