import { describe, it, expect } from "vitest";
import {
  DEFAULT_STATE,
  MAX_GUESSES,
  STATE_ALIASES,
  alreadyGuessed,
  buildNameIndex,
  buildSummary,
  feedbackForGuess,
  isLost,
  isOver,
  isWon,
  normalizeStateName,
  resolveGuess,
  squaresForPct,
  type StatesIndex,
} from "./logic";

// A small fixture with real names and roughly-real centroids ([lon, lat]) — enough to exercise
// alias resolution and feedback wiring without depending on the generated silhouettes.json (which
// can change shape independently; see silhouette.test.ts for the same reasoning).
const STATES: StatesIndex = {
  "IN-OD": { name: "Odisha", centroid: [84.2, 20.5] },
  "IN-KA": { name: "Karnataka", centroid: [75.7, 15.3] },
  "IN-TN": { name: "Tamil Nadu", centroid: [78.4, 11.0] },
  "IN-PY": { name: "Puducherry", centroid: [79.8, 11.9] },
  "IN-UK": { name: "Uttarakhand", centroid: [79.3, 30.1] },
  "IN-DL": { name: "Delhi", centroid: [77.1, 28.6] },
  "IN-AN": { name: "Andaman & Nicobar", centroid: [93.0, 11.2] },
  "IN-DH": { name: "Dadra and Nagar Haveli and Daman and Diu", centroid: [72.9, 20.2] },
  "IN-CG": { name: "Chhattisgarh", centroid: [82.0, 21.3] },
  "IN-UP": { name: "Uttar Pradesh", centroid: [80.6, 26.9] },
  "IN-JK": { name: "Jammu & Kashmir", centroid: [76.6, 33.8] },
};

const MAX_DISTANCE_KM = 3105; // India's own max centroid-to-centroid distance (from the generator)

const NAME_INDEX = buildNameIndex(STATES);

describe("normalizeStateName", () => {
  it("folds case, '&'/'and', punctuation and whitespace to the same key", () => {
    expect(normalizeStateName("Jammu & Kashmir")).toBe(normalizeStateName("jammu and kashmir"));
    expect(normalizeStateName("Jammu   &  Kashmir.")).toBe(normalizeStateName("jammu and kashmir"));
  });
});

describe("buildNameIndex / resolveGuess", () => {
  it("resolves every state's own canonical name", () => {
    expect(resolveGuess("Odisha", NAME_INDEX)).toBe("IN-OD");
    expect(resolveGuess("  odisha ", NAME_INDEX)).toBe("IN-OD");
  });

  it.each([
    ["Orissa", "IN-OD"],
    ["orissa", "IN-OD"],
    ["Mysore", "IN-KA"],
    ["Madras", "IN-TN"],
    ["Pondicherry", "IN-PY"],
    ["Pondy", "IN-PY"],
    ["Uttaranchal", "IN-UK"],
    ["NCT of Delhi", "IN-DL"],
    ["National Capital Territory of Delhi", "IN-DL"],
    ["New Delhi", "IN-DL"],
    ["Andaman and Nicobar Islands", "IN-AN"],
    ["Daman and Diu", "IN-DH"],
    ["Dadra and Nagar Haveli", "IN-DH"],
    ["Chattisgarh", "IN-CG"],
    ["UP", "IN-UP"],
    ["up", "IN-UP"],
  ])("resolves former/short name %s -> %s", (typed, code) => {
    expect(resolveGuess(typed, NAME_INDEX)).toBe(code);
  });

  it("resolves '&' and 'and' interchangeably for a canonical name", () => {
    expect(resolveGuess("J&K", NAME_INDEX)).toBeNull(); // not an aliased short form, see RESEARCH.md
    expect(resolveGuess("Jammu and Kashmir", NAME_INDEX)).toBe("IN-JK");
    expect(resolveGuess("Jammu & Kashmir", NAME_INDEX)).toBe("IN-JK");
  });

  it("returns null for unresolvable input, including deliberately-omitted aliases", () => {
    expect(resolveGuess("Narnia", NAME_INDEX)).toBeNull();
    expect(resolveGuess("", NAME_INDEX)).toBeNull();
    expect(resolveGuess("Bombay", NAME_INDEX)).toBeNull(); // split into two states, see RESEARCH.md
    expect(resolveGuess("UK", NAME_INDEX)).toBeNull(); // reads as "United Kingdom", see RESEARCH.md
  });

  it("never lets an alias shadow a real state's own canonical name", () => {
    for (const info of Object.values(STATES)) {
      expect(NAME_INDEX.get(normalizeStateName(info.name))).toBe(
        Object.entries(STATES).find(([, v]) => v === info)![0],
      );
    }
  });

  it("every alias target is actually a key in the fixture or a real code format", () => {
    for (const code of Object.values(STATE_ALIASES)) {
      expect(code).toMatch(/^IN-[A-Z]{2}$/);
    }
  });
});

describe("feedbackForGuess", () => {
  it("scores a correct guess as 100% with a 0 km / 0° / target emoji", () => {
    const r = feedbackForGuess("IN-OD", "IN-OD", STATES, MAX_DISTANCE_KM);
    expect(r).toMatchObject({ correct: true, distanceKm: 0, proximityPct: 100, arrow: "🎯" });
  });

  it("scores a wrong guess with a real distance, arrow and proximity < 100", () => {
    const r = feedbackForGuess("IN-KA", "IN-OD", STATES, MAX_DISTANCE_KM);
    expect(r.correct).toBe(false);
    expect(r.distanceKm).toBeGreaterThan(0);
    expect(r.proximityPct).toBeLessThan(100);
    expect(r.proximityPct).toBeGreaterThanOrEqual(0);
    expect(r.arrow).not.toBe("🎯");
  });
});

describe("win / loss", () => {
  it("wins the instant any guess matches, even with guesses remaining", () => {
    const state = { guesses: ["IN-KA", "IN-OD"] };
    expect(isWon(state, "IN-OD")).toBe(true);
    expect(isOver(state, "IN-OD")).toBe(true);
    expect(isLost(state, "IN-OD")).toBe(false);
  });

  it("wins on the last (6th) guess", () => {
    const state = { guesses: ["IN-KA", "IN-TN", "IN-PY", "IN-UK", "IN-DL", "IN-OD"] };
    expect(state.guesses).toHaveLength(MAX_GUESSES);
    expect(isWon(state, "IN-OD")).toBe(true);
    expect(isOver(state, "IN-OD")).toBe(true);
  });

  it("loses on the 6th guess if still wrong", () => {
    const state = { guesses: ["IN-KA", "IN-TN", "IN-PY", "IN-UK", "IN-DL", "IN-CG"] };
    expect(state.guesses).toHaveLength(MAX_GUESSES);
    expect(isWon(state, "IN-OD")).toBe(false);
    expect(isLost(state, "IN-OD")).toBe(true);
    expect(isOver(state, "IN-OD")).toBe(true);
  });

  it("is not over before 6 guesses and no win", () => {
    const state = { guesses: ["IN-KA", "IN-TN"] };
    expect(isOver(state, "IN-OD")).toBe(false);
  });

  it("alreadyGuessed reports a prior guess", () => {
    const state = { guesses: ["IN-KA"] };
    expect(alreadyGuessed(state, "IN-KA")).toBe(true);
    expect(alreadyGuessed(state, "IN-OD")).toBe(false);
  });
});

describe("squaresForPct (Worldle's own rounding rule)", () => {
  it("matches the FAQ's worked example: 72% -> 🟩🟩🟩🟨⬛", () => {
    expect(squaresForPct(72)).toBe("🟩🟩🟩🟨⬛");
  });

  it.each([
    [100, "🟩🟩🟩🟩🟩"],
    [99, "🟩🟩🟩🟩🟨"], // floors to 90
    [90, "🟩🟩🟩🟩🟨"],
    [80, "🟩🟩🟩🟩⬛"],
    [70, "🟩🟩🟩🟨⬛"],
    [60, "🟩🟩🟩⬛⬛"],
    [10, "🟨⬛⬛⬛⬛"],
    [9, "⬛⬛⬛⬛⬛"],
    [0, "⬛⬛⬛⬛⬛"],
  ])("%i%% -> %s", (pct, expected) => {
    expect(squaresForPct(pct)).toBe(expected);
  });
});

describe("buildSummary", () => {
  it("never contains any state's name or code, for every answer and every guess", () => {
    const codes = Object.keys(STATES);
    for (const answerCode of codes) {
      const state = { guesses: [...codes].slice(0, MAX_GUESSES) };
      const summary = buildSummary(state, answerCode, STATES, MAX_DISTANCE_KM, 1);
      for (const code of codes) {
        expect(summary).not.toContain(code);
        expect(summary.toLowerCase()).not.toContain(STATES[code].name.toLowerCase());
      }
    }
  });

  it("shows the guess count on a win and 'X' on a loss", () => {
    const won = { guesses: ["IN-OD"] };
    expect(buildSummary(won, "IN-OD", STATES, MAX_DISTANCE_KM, 7)).toMatch(/^States #7 1\/6\n/);

    const lost = { guesses: ["IN-KA", "IN-TN", "IN-PY", "IN-UK", "IN-DL", "IN-CG"] };
    expect(buildSummary(lost, "IN-OD", STATES, MAX_DISTANCE_KM, 7)).toMatch(/^States #7 X\/6\n/);
  });

  it("has one square-row per guess", () => {
    const state = { guesses: ["IN-KA", "IN-TN", "IN-OD"] };
    const summary = buildSummary(state, "IN-OD", STATES, MAX_DISTANCE_KM, 1);
    const rows = summary.split("\n").slice(1);
    expect(rows).toHaveLength(3);
  });
});

describe("state round-trips through JSON", () => {
  it("is bit-for-bit identical after a JSON round trip", () => {
    const state = { guesses: ["IN-KA", "IN-TN", "IN-OD"] };
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored).toEqual(state);
  });

  it("DEFAULT_STATE round-trips too (the '{}' gotcha case)", () => {
    const restored = JSON.parse(JSON.stringify(DEFAULT_STATE));
    expect(restored).toEqual(DEFAULT_STATE);
  });
});
