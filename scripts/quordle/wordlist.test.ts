import { describe, expect, it } from "vitest";
import { buildWordPools } from "./wordlist";

const ENABLE1 = ["apple", "mango", "grape", "peach", "sissy", "aahed"].join("\n");
const COMMON = ["apple", "mango", "grape", "other", "1", "10"].join("\n"); // "other" not in ENABLE1
const BLOCKLIST = ["mango"].join("\n");

describe("buildWordPools", () => {
  it("valid guesses are every 5-letter ENABLE1 word, uppercase", () => {
    const { validGuesses } = buildWordPools(ENABLE1, COMMON, BLOCKLIST);
    expect(validGuesses).toEqual(["AAHED", "APPLE", "GRAPE", "MANGO", "PEACH", "SISSY"]);
  });

  it("fair answers are ENABLE1 ∩ common, minus blocklist", () => {
    const { fairAnswers } = buildWordPools(ENABLE1, COMMON, BLOCKLIST);
    // "mango" is in both ENABLE1 and common but removed by the blocklist.
    // "other" is in common but not ENABLE1, so it's never a candidate either way.
    expect(fairAnswers).toEqual(["APPLE", "GRAPE"]);
  });

  it("ignores non-5-letter and non-alphabetic lines (including common.txt's stray numerals)", () => {
    const { fairAnswers, validGuesses } = buildWordPools(ENABLE1, COMMON, BLOCKLIST);
    expect(validGuesses.join(" ")).not.toMatch(/\d/);
    expect(fairAnswers.join(" ")).not.toMatch(/\d/);
  });

  it("is case-insensitive on input", () => {
    const { validGuesses } = buildWordPools("APPLE\nMango", "apple\nMANGO", "");
    expect(validGuesses).toEqual(["APPLE", "MANGO"]);
  });
});
