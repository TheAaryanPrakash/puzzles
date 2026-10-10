import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isWon,
  isLost,
  isOver,
  alreadyGuessed,
  revealOrder,
  hiddenTiles,
  feedbackFor,
  buildSummary,
  MAX_GUESSES,
  TOTAL_TILES,
  type FlagleState,
} from "./logic";

// Read with node:fs rather than a static JSON import: the file lives under public/, outside
// tsconfig.app.json's "src" rootDir, so a static import would fail `tsc -b` during `pnpm build`.
// Vitest's root is the repo root, so this resolves the same way `pnpm test` is always invoked.
const countryNamesPath = resolve(process.cwd(), "public/assets/shared/country-names.json");
const countryNames = JSON.parse(readFileSync(countryNamesPath, "utf8")) as Record<
  string,
  { name: string; aliases: string[] }
>;
const POOL_CODES = Object.keys(countryNames);

describe("isWon / isLost / isOver", () => {
  it("is won once the target has been guessed", () => {
    const state: FlagleState = { guesses: ["FR", "DE", "IN"] };
    expect(isWon(state, "IN")).toBe(true);
    expect(isLost(state, "IN")).toBe(false);
    expect(isOver(state, "IN")).toBe(true);
  });

  it("wins on the very first guess", () => {
    const state: FlagleState = { guesses: ["IN"] };
    expect(isWon(state, "IN")).toBe(true);
  });

  it("wins on the last (6th) guess", () => {
    const state: FlagleState = { guesses: ["A1", "A2", "A3", "A4", "A5", "IN"] };
    expect(isWon(state, "IN")).toBe(true);
    expect(isLost(state, "IN")).toBe(false);
  });

  it("is lost after MAX_GUESSES wrong guesses", () => {
    const state: FlagleState = { guesses: ["A1", "A2", "A3", "A4", "A5", "A6"] };
    expect(state.guesses.length).toBe(MAX_GUESSES);
    expect(isWon(state, "IN")).toBe(false);
    expect(isLost(state, "IN")).toBe(true);
    expect(isOver(state, "IN")).toBe(true);
  });

  it("is neither won nor lost mid-game", () => {
    const state: FlagleState = { guesses: ["FR"] };
    expect(isOver(state, "IN")).toBe(false);
  });
});

describe("alreadyGuessed", () => {
  it("flags a code that's already in the guess list", () => {
    const state: FlagleState = { guesses: ["FR", "DE"] };
    expect(alreadyGuessed(state, "FR")).toBe(true);
    expect(alreadyGuessed(state, "IN")).toBe(false);
  });
});

describe("revealOrder", () => {
  it("is a permutation of [0, TOTAL_TILES)", () => {
    const order = revealOrder("2026-10-17");
    expect(order.length).toBe(TOTAL_TILES);
    expect(new Set(order).size).toBe(TOTAL_TILES);
    for (const i of order) expect(i).toBeGreaterThanOrEqual(0);
    for (const i of order) expect(i).toBeLessThan(TOTAL_TILES);
  });

  it("is stable for the same date", () => {
    expect(revealOrder("2026-11-02")).toEqual(revealOrder("2026-11-02"));
  });

  it("differs across at least some dates", () => {
    const orders = new Set(
      Array.from({ length: 10 }, (_, i) => JSON.stringify(revealOrder(`2026-10-${10 + i}`))),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("hiddenTiles", () => {
  const date = "2026-10-17";

  it("starts with every tile hidden", () => {
    expect(hiddenTiles({ guesses: [] }, date).length).toBe(TOTAL_TILES);
  });

  it("shrinks by one per guess, capped at TOTAL_TILES - 1", () => {
    for (let n = 0; n <= MAX_GUESSES; n++) {
      const state: FlagleState = { guesses: Array.from({ length: n }, (_, i) => `X${i}`) };
      const expected = TOTAL_TILES - Math.min(n, TOTAL_TILES - 1);
      expect(hiddenTiles(state, date).length).toBe(expected);
    }
  });

  it("the last guess (6th, a loss) still leaves exactly one tile hidden", () => {
    const state: FlagleState = { guesses: ["A1", "A2", "A3", "A4", "A5", "A6"] };
    expect(hiddenTiles(state, date).length).toBe(1);
  });

  it("every hidden index is drawn from revealOrder(date)", () => {
    const order = revealOrder(date);
    const hidden = hiddenTiles({ guesses: ["A1", "A2"] }, date);
    for (const i of hidden) expect(order).toContain(i);
  });
});

describe("feedbackFor", () => {
  const centroids: Record<string, [number, number]> = {
    IN: [78, 22],
    FR: [2, 47],
  };

  it("reports a correct guess with zero distance and full proximity", () => {
    const fb = feedbackFor("IN", "IN", centroids);
    expect(fb).toEqual({ correct: true, distanceKm: 0, bearingDeg: 0, arrow: "🎯", proximityPct: 100 });
  });

  it("reports distance, a compass arrow and a proximity percentage for a wrong guess", () => {
    const fb = feedbackFor("FR", "IN", centroids);
    expect(fb).not.toBeNull();
    expect(fb!.correct).toBe(false);
    expect(fb!.distanceKm).toBeGreaterThan(0);
    expect(fb!.proximityPct).toBeGreaterThanOrEqual(0);
    expect(fb!.proximityPct).toBeLessThan(100);
    expect(typeof fb!.arrow).toBe("string");
    expect(fb!.arrow.length).toBeGreaterThan(0);
  });

  it("returns null when a code has no known centroid", () => {
    expect(feedbackFor("ZZ", "IN", centroids)).toBeNull();
    expect(feedbackFor("IN", "ZZ", centroids)).toBeNull();
  });
});

describe("buildSummary", () => {
  it("shows the guess count on a win and X on a loss", () => {
    const won: FlagleState = { guesses: ["FR", "DE", "IN"] };
    expect(buildSummary(won, "IN", 1)).toContain("3/6");

    const lost: FlagleState = { guesses: ["A1", "A2", "A3", "A4", "A5", "A6"] };
    expect(buildSummary(lost, "IN", 1)).toContain("X/6");
  });

  it("renders one emoji per guess, green only for the correct one", () => {
    const state: FlagleState = { guesses: ["FR", "DE", "IN"] };
    const summary = buildSummary(state, "IN", 1);
    const gridLine = summary.split("\n")[1];
    expect(gridLine).toBe("🟥🟥🟩");
  });

  it("never contains the target's ISO code or name, for every country in the pool", () => {
    for (const code of POOL_CODES) {
      const other = code === "AF" ? "ZW" : "AF"; // any other pool code as a filler wrong guess
      const state: FlagleState = { guesses: [other, code] };
      const summary = buildSummary(state, code, 42);
      expect(summary).not.toContain(code);
      expect(summary).not.toContain(countryNames[code].name);
    }
  });
});
