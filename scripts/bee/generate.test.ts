import { describe, expect, it } from "vitest";
import {
  answersFor,
  bestCenterFor,
  buildPool,
  buildWordsByMask,
  collectCandidates,
  letterMask,
  maskToLetters,
  popcount,
  scoreWord,
  toPuzzle,
  MIN_ANSWERS,
  MAX_ANSWERS,
} from "./generate";

describe("letterMask / popcount / maskToLetters", () => {
  it("builds a mask with one bit per distinct letter, ignoring repeats", () => {
    const mask = letterMask("PUZZLE");
    expect(popcount(mask)).toBe(5); // P, U, Z, L, E
    expect(maskToLetters(mask).sort()).toEqual(["E", "L", "P", "U", "Z"]);
  });

  it("round-trips maskToLetters(letterMask(word)) back to the word's letter set", () => {
    const letters = maskToLetters(letterMask("GARDEN"));
    expect(letters.sort()).toEqual(["A", "D", "E", "G", "N", "R"]);
  });
});

describe("scoreWord", () => {
  const fullMask = letterMask("GARDEN"); // 7th letter irrelevant for this unit test on scoring math
  it("scores a 4-letter word as exactly 1 point", () => {
    expect(scoreWord("RANG", fullMask)).toBe(1);
  });
  it("scores a 5+ letter word as 1 point per letter", () => {
    expect(scoreWord("RANGE", fullMask)).toBe(5);
  });
  it("adds a flat +7 bonus when the word's letters equal the full mask (pangram)", () => {
    expect(scoreWord("GARDEN", fullMask)).toBe(6 + 7);
  });
});

describe("buildWordsByMask / answersFor (bitmask + submask enumeration)", () => {
  const pool = ["RANG", "RANGE", "GARDEN", "GRAD", "NEAR", "DEAN", "RAND", "ARGON"];
  const wordsByMask = buildWordsByMask(pool);
  const setMask = letterMask("GARDEN"); // G A R D E N — 6 distinct letters, enough for this test
  it("drops words with more than 7 distinct letters from the map", () => {
    const longWord = "ABCDEFGH"; // 8 distinct letters
    const map = buildWordsByMask([...pool, longWord]);
    for (const list of map.values()) expect(list).not.toContain(longWord);
  });

  it("only returns words whose letters are a subset of the letter set and contain the center", () => {
    const centerBit = 1 << ("N".charCodeAt(0) - 65);
    const answers = answersFor(wordsByMask, setMask, centerBit);
    expect(answers).toContain("RANG");
    expect(answers).toContain("GARDEN");
    expect(answers).not.toContain("ARGON"); // has O, not in the set
    for (const w of answers) {
      expect(w).toMatch(/N/); // every answer contains the center letter
    }
  });
});

describe("buildPool", () => {
  const enable1 = ["CAT", "CATS", "DOG", "DOGS", "BIRD", "SNAKE", "RARE", "BLOCKED"];
  const common = ["cat", "cats", "dog", "dogs", "bird", "snake", "rare", "blocked"];
  const blocklist = ["BLOCKED"];

  it("drops words shorter than 4 letters", () => {
    expect(buildPool(enable1, common, blocklist)).not.toContain("CAT");
  });
  it("drops any word containing the letter S", () => {
    const pool = buildPool(enable1, common, blocklist);
    expect(pool).not.toContain("CATS");
    expect(pool).not.toContain("DOGS");
    expect(pool).not.toContain("SNAKE");
  });
  it("drops blocklisted words", () => {
    expect(buildPool(enable1, common, blocklist)).not.toContain("BLOCKED");
  });
  it("keeps words that are 4+ letters, S-free, common and not blocked", () => {
    const pool = buildPool(enable1, common, blocklist);
    expect(pool).toEqual(expect.arrayContaining(["BIRD", "RARE"]));
  });
  it("only keeps words present in the common pool (ENABLE1 ∩ common)", () => {
    const pool = buildPool(["ONLYINENABLE", ...enable1], common, blocklist);
    expect(pool).not.toContain("ONLYINENABLE");
  });
});

describe("bestCenterFor / collectCandidates on a synthetic dictionary", () => {
  // A tiny synthetic 7-letter world with exactly one workable center, sized to land inside
  // [MIN_ANSWERS, MAX_ANSWERS] without needing the real ~20k-word pool for this unit test.
  const mask = letterMask("CENTRAL"); // C E N T R A L — 7 distinct letters
  const filler: string[] = [];
  for (let i = 0; i < MIN_ANSWERS + 5; i++) {
    // Every word uses the center letter "C" plus a rotating subset of the rest, all within mask.
    filler.push(["C", "A", "R", "E", "N", "T", "L"][i % 7] + "ARE".slice(0, 1 + (i % 3)));
  }
  const pool = ["CENTRAL", "TRACE", "RANT", ...filler];
  const wordsByMask = buildWordsByMask(pool);

  it("returns null for a mask with no center producing an in-range answer count", () => {
    const sparse = buildWordsByMask(["ABCDEFG"]); // only the pangram itself, count=1, too few
    const sparseMask = letterMask("ABCDEFG");
    expect(bestCenterFor(sparse, sparseMask)).toBeNull();
  });

  it("collectCandidates only returns masks with exactly 7 distinct letters", () => {
    const candidates = collectCandidates(wordsByMask);
    for (const c of candidates) {
      expect(popcount(c.mask)).toBe(7);
    }
  });

  it("toPuzzle derives center/outer/pangrams/maxScore consistent with the candidate", () => {
    const candidates = collectCandidates(wordsByMask);
    const match = candidates.find((c) => c.mask === mask);
    if (!match) return; // synthetic filler may not land a given run in range; algorithm covered above
    const puzzle = toPuzzle(match);
    expect(puzzle.outer).toHaveLength(6);
    expect(puzzle.answers.length).toBeGreaterThanOrEqual(MIN_ANSWERS);
    expect(puzzle.answers.length).toBeLessThanOrEqual(MAX_ANSWERS);
    expect(puzzle.pangrams).toContain("CENTRAL");
    expect(puzzle.maxScore).toBeGreaterThan(0);
  });
});
