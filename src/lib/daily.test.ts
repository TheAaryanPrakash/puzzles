import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { todayKey, resolvePuzzleDate, addDays, dayIndex, mulberry32, shuffle } from "./daily";
import { LAUNCH_DATE } from "../config";

describe("todayKey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is still the previous IST day just before midnight IST (18:29 UTC)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T18:29:00.000Z"));
    expect(todayKey()).toBe("2026-10-10");
  });

  it("rolls over to the next IST day just after midnight IST (18:31 UTC)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T18:31:00.000Z"));
    expect(todayKey()).toBe("2026-10-11");
  });

  it("respects a ?date= override only in dev", () => {
    const original = window.location.href;
    window.history.pushState({}, "", "/?date=2099-01-01");
    expect(todayKey()).toBe(import.meta.env.DEV ? "2099-01-01" : expect.any(String));
    window.history.pushState({}, "", original);
  });
});

describe("resolvePuzzleDate", () => {
  // today = LAUNCH_DATE + 10, fixed via fake timers at a safe midday-IST instant.
  const TODAY = addDays(LAUNCH_DATE, 10);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T08:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  it("is today with no ?day= param", () => {
    expect(resolvePuzzleDate()).toBe(TODAY);
  });

  it("is the requested day when it's between LAUNCH_DATE and today", () => {
    const day = addDays(LAUNCH_DATE, 5);
    window.history.pushState({}, "", `/wordle?day=${day}`);
    expect(resolvePuzzleDate()).toBe(day);
  });

  it("accepts the boundaries: LAUNCH_DATE and today itself", () => {
    window.history.pushState({}, "", `/wordle?day=${LAUNCH_DATE}`);
    expect(resolvePuzzleDate()).toBe(LAUNCH_DATE);

    window.history.pushState({}, "", `/wordle?day=${TODAY}`);
    expect(resolvePuzzleDate()).toBe(TODAY);
  });

  it("falls back to today when the day is before LAUNCH_DATE", () => {
    window.history.pushState({}, "", `/wordle?day=${addDays(LAUNCH_DATE, -1)}`);
    expect(resolvePuzzleDate()).toBe(TODAY);
  });

  it("falls back to today when the day is in the future", () => {
    window.history.pushState({}, "", `/wordle?day=${addDays(TODAY, 1)}`);
    expect(resolvePuzzleDate()).toBe(TODAY);
  });

  it("falls back to today for a malformed day", () => {
    window.history.pushState({}, "", "/wordle?day=not-a-date");
    expect(resolvePuzzleDate()).toBe(TODAY);
  });

  it("works in production builds too (not gated on DEV)", () => {
    const day = addDays(LAUNCH_DATE, 2);
    window.history.pushState({}, "", `/wordle?day=${day}`);
    // Sanity: this test doesn't stub import.meta.env.DEV at all, unlike todayKey's ?date= test —
    // resolvePuzzleDate must not read it.
    expect(resolvePuzzleDate()).toBe(day);
  });
});

describe("addDays", () => {
  it("adds and subtracts days across month and year boundaries", () => {
    expect(addDays("2026-10-17", 1)).toBe("2026-10-18");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-17", -1)).toBe("2026-10-16");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dayIndex", () => {
  it("is 0 on launch day and increments daily after it", () => {
    expect(dayIndex(LAUNCH_DATE)).toBe(0);
    expect(dayIndex(addDays(LAUNCH_DATE, 1))).toBe(1);
    expect(dayIndex(addDays(LAUNCH_DATE, 30))).toBe(30);
  });

  it("is negative before launch day", () => {
    expect(dayIndex(addDays(LAUNCH_DATE, -1))).toBe(-1);
  });
});

describe("mulberry32", () => {
  it("is deterministic: same seed, same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });

  it("produces floats in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("is deterministic for a given seed", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle(items, mulberry32(123));
    const b = shuffle(items, mulberry32(123));
    expect(a).toEqual(b);
  });

  it("does not mutate the input array", () => {
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    shuffle(items, mulberry32(1));
    expect(items).toEqual(copy);
  });

  it("preserves all elements (a permutation)", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = shuffle(items, mulberry32(9));
    expect([...result].sort()).toEqual([...items].sort());
  });
});
