import { describe, it, expect } from "vitest";
import {
  evaluateGuess,
  isWon,
  isLost,
  isOver,
  searchCountries,
  nameFor,
  buildSummary,
  MAX_GUESSES,
  type WorldleState,
  type CountryNames,
  type CountryCentroids,
} from "./logic";

const CENTROIDS: CountryCentroids = {
  IN: [78.9, 20.6], // India
  US: [-98.8, 39.9], // USA
  FR: [2.2, 46.6], // France
  AQ: [0, -90], // the antipode of IN-ish, used only as a stand-in far point below
};

const NAMES: CountryNames = {
  IN: { name: "India", aliases: ["Bharat"] },
  US: { name: "United States", aliases: ["USA", "United States of America", "America"] },
  FR: { name: "France", aliases: [] },
  AE: { name: "United Arab Emirates", aliases: ["UAE"] },
};

describe("evaluateGuess", () => {
  it("reports a correct guess as 0 km, 100% proximity, no arrow", () => {
    const fb = evaluateGuess("IN", "IN", CENTROIDS);
    expect(fb).toMatchObject({ correct: true, distanceKm: 0, proximityPct: 100, arrow: "" });
  });

  it("reports distance, bearing and proximity for a wrong guess", () => {
    const fb = evaluateGuess("FR", "IN", CENTROIDS);
    expect(fb.correct).toBe(false);
    expect(fb.distanceKm).toBeGreaterThan(0);
    expect(fb.arrow.length).toBeGreaterThan(0);
    expect(fb.proximityPct).toBeGreaterThan(0);
    expect(fb.proximityPct).toBeLessThan(100);
  });

  it("scores the antipodal point at 0% proximity", () => {
    // literally opposite ends of the Earth from [0, -90] would be [*, 90]; use the north pole.
    const centroids: CountryCentroids = { A: [0, -90], B: [0, 90] };
    const fb = evaluateGuess("A", "B", centroids);
    expect(fb.proximityPct).toBe(0);
  });

  it("throws if a centroid is missing", () => {
    expect(() => evaluateGuess("US", "ZZ" as string, CENTROIDS)).toThrow();
  });
});

describe("isWon / isLost / isOver", () => {
  it("wins the instant the secret is guessed, even on the first try", () => {
    const state: WorldleState = { guesses: ["IN"] };
    expect(isWon(state, "IN")).toBe(true);
    expect(isOver(state, "IN")).toBe(true);
  });

  it("wins on the very last allowed guess", () => {
    const state: WorldleState = { guesses: ["US", "FR", "US", "FR", "US", "IN"] };
    expect(state.guesses).toHaveLength(MAX_GUESSES);
    expect(isWon(state, "IN")).toBe(true);
    expect(isLost(state, "IN")).toBe(false);
  });

  it("loses after MAX_GUESSES wrong guesses", () => {
    const state: WorldleState = { guesses: Array(MAX_GUESSES).fill("US") };
    expect(isWon(state, "IN")).toBe(false);
    expect(isLost(state, "IN")).toBe(true);
    expect(isOver(state, "IN")).toBe(true);
  });

  it("is neither won nor lost mid-game", () => {
    const state: WorldleState = { guesses: ["US", "FR"] };
    expect(isOver(state, "IN")).toBe(false);
  });
});

describe("searchCountries", () => {
  it("matches on alias, not just the canonical name", () => {
    const results = searchCountries("uae", NAMES);
    expect(results.map((r) => r.code)).toContain("AE");
  });

  it("finds the United States via an alias without matching unrelated names", () => {
    const results = searchCountries("america", NAMES);
    expect(results.map((r) => r.code)).toEqual(["US"]);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(searchCountries("  InDiA  ", NAMES).map((r) => r.code)).toContain("IN");
  });

  it("excludes already-guessed codes", () => {
    const results = searchCountries("united", NAMES, ["US"]);
    expect(results.map((r) => r.code)).not.toContain("US");
  });

  it("returns nothing for a blank query", () => {
    expect(searchCountries("   ", NAMES)).toEqual([]);
  });

  it("ranks an exact match first", () => {
    const results = searchCountries("india", NAMES);
    expect(results[0].code).toBe("IN");
  });
});

describe("nameFor", () => {
  it("resolves a code to its display name", () => {
    expect(nameFor("IN", NAMES)).toBe("India");
  });

  it("falls back to the raw code if unknown", () => {
    expect(nameFor("ZZ", NAMES)).toBe("ZZ");
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical game", () => {
    const state: WorldleState = { guesses: ["US", "FR", "IN"] };
    const restored = JSON.parse(JSON.stringify(state)) as WorldleState;
    expect(restored).toEqual(state);
    expect(isWon(restored, "IN")).toBe(isWon(state, "IN"));
  });
});

describe("buildSummary", () => {
  it("never contains the secret's code or name", () => {
    for (const secret of ["IN", "US", "FR"]) {
      const other = Object.keys(CENTROIDS).find((c) => c !== secret && NAMES[c])!;
      const state: WorldleState = { guesses: [other, secret] };
      const summary = buildSummary(state, secret, 7, CENTROIDS);
      expect(summary).not.toContain(secret);
      expect(summary.toLowerCase()).not.toContain(NAMES[secret]!.name.toLowerCase());
    }
  });

  it("shows the guess count on a win and X on a loss", () => {
    const won: WorldleState = { guesses: ["US", "FR", "IN"] };
    expect(buildSummary(won, "IN", 1, CENTROIDS)).toContain("3/6");

    const lost: WorldleState = { guesses: Array(MAX_GUESSES).fill("US") };
    expect(buildSummary(lost, "IN", 1, CENTROIDS)).toContain(`X/${MAX_GUESSES}`);
  });

  it("includes the puzzle number", () => {
    const state: WorldleState = { guesses: ["IN"] };
    expect(buildSummary(state, "IN", 42, CENTROIDS)).toContain("#42");
  });
});
