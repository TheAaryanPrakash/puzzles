import { describe, expect, it } from "vitest";
import { assignDailyAnswers } from "./schedule";

function makePool(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `WORD${i.toString().padStart(2, "0")}`);
}

describe("assignDailyAnswers", () => {
  const days = ["2026-10-17", "2026-10-18", "2026-10-19"];

  it("assigns boardsPerDay distinct words to every day", () => {
    const result = assignDailyAnswers({ seed: 2, days, pool: makePool(20) });
    for (const date of days) {
      const words = result.get(date)!;
      expect(words).toHaveLength(4);
      expect(new Set(words).size).toBe(4);
    }
  });

  it("never repeats an answer anywhere in the schedule when the pool has enough slack", () => {
    const result = assignDailyAnswers({ seed: 2, days, pool: makePool(20) });
    const all = days.flatMap((d) => result.get(d)!);
    expect(new Set(all).size).toBe(all.length);
  });

  it("is deterministic for the same seed and pool", () => {
    const a = assignDailyAnswers({ seed: 2, days, pool: makePool(20) });
    const b = assignDailyAnswers({ seed: 2, days, pool: makePool(20) });
    for (const date of days) expect(a.get(date)).toEqual(b.get(date));
  });

  it("a different seed produces a different schedule", () => {
    const a = assignDailyAnswers({ seed: 2, days, pool: makePool(20) });
    const b = assignDailyAnswers({ seed: 3, days, pool: makePool(20) });
    expect(days.some((d) => a.get(d)!.join(",") !== b.get(d)!.join(","))).toBe(true);
  });

  it("throws when the pool can't cover the full schedule", () => {
    expect(() => assignDailyAnswers({ seed: 2, days, pool: makePool(10) })).toThrow(/too small/);
  });

  it("skips a day's excluded word instead of assigning it, without affecting other days", () => {
    const pool = makePool(20);
    const withoutExclusion = assignDailyAnswers({ seed: 2, days, pool });
    const excludedWord = withoutExclusion.get(days[1])![0]; // force a real collision on day 1

    const excludedByDate = new Map([[days[1], excludedWord]]);
    const withExclusion = assignDailyAnswers({ seed: 2, days, pool, excludedByDate });

    expect(withExclusion.get(days[1])).not.toContain(excludedWord);
    expect(withExclusion.get(days[1])).toHaveLength(4);
    // Day 0 (before the collision) is unaffected since the cursor hadn't reached the excluded word yet.
    expect(withExclusion.get(days[0])).toEqual(withoutExclusion.get(days[0]));
  });

  it("throws if exclusions consume all the slack in the pool", () => {
    // Pool exactly covers the schedule with zero spare words - any exclusion must fail.
    const pool = makePool(days.length * 4);
    const baseline = assignDailyAnswers({ seed: 2, days, pool });
    const excludedWord = baseline.get(days[0])![0]; // guaranteed to land in day0's own window
    const excludedByDate = new Map([[days[0], excludedWord]]);
    expect(() => assignDailyAnswers({ seed: 2, days, pool, excludedByDate })).toThrow(/ran out/);
  });
});
