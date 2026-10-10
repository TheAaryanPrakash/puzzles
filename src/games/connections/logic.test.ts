import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_STATE,
  MAX_MISTAKES,
  allWords,
  initialOrder,
  effectiveOrder,
  shuffleRemaining,
  evaluateGuess,
  isDuplicateGuess,
  solvedGroups,
  solvedWordSet,
  countMistakes,
  isWon,
  isLost,
  isOver,
  remainingGroupsByLevel,
  buildSummary,
  type ConnectionsPuzzle,
  type ConnectionsState,
} from "./logic";

const PUZZLE: ConnectionsPuzzle = {
  groups: [
    { label: "WET WEATHER", level: 0, words: ["SNOW", "RAIN", "SLEET", "HAIL"] },
    { label: "KEYBOARD KEYS", level: 1, words: ["SHIFT", "TAB", "ENTER", "SPACE"] },
    { label: "PALINDROMES", level: 2, words: ["LEVEL", "RACECAR", "KAYAK", "CIVIC"] },
    { label: "BOXING TERMS", level: 3, words: ["JAB", "HOOK", "RING", "BELL"] },
  ],
};

describe("allWords / initialOrder", () => {
  it("allWords flattens every group", () => {
    expect(allWords(PUZZLE)).toHaveLength(16);
  });

  it("initialOrder is a permutation of all 16 words", () => {
    const order = initialOrder(PUZZLE, "2026-10-17");
    expect(order).toHaveLength(16);
    expect(new Set(order)).toEqual(new Set(allWords(PUZZLE)));
  });

  it("initialOrder is deterministic for the same date, and differs for a different date", () => {
    const a = initialOrder(PUZZLE, "2026-10-17");
    const b = initialOrder(PUZZLE, "2026-10-17");
    const c = initialOrder(PUZZLE, "2026-10-18");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("effectiveOrder", () => {
  it("falls back to initialOrder when state.order is empty (the {} gotcha right after start())", () => {
    const state: ConnectionsState = { ...DEFAULT_STATE };
    expect(effectiveOrder(state, PUZZLE, "2026-10-17")).toEqual(initialOrder(PUZZLE, "2026-10-17"));
  });

  it("uses the saved order once it's a full permutation", () => {
    const saved = [...allWords(PUZZLE)].reverse();
    const state: ConnectionsState = { guesses: [], order: saved };
    expect(effectiveOrder(state, PUZZLE, "2026-10-17")).toEqual(saved);
  });
});

describe("shuffleRemaining", () => {
  it("only reorders unsolved words, leaving solved slots' content set unchanged as a set", () => {
    const order = allWords(PUZZLE);
    const solved = new Set(PUZZLE.groups[0].words); // WET WEATHER solved
    const rng = () => 0.42; // fixed "random" value, deterministic for the test
    const next = shuffleRemaining(order, solved, rng);
    expect(next).toHaveLength(16);
    // the solved words still occupy exactly the positions they held before (set-wise)
    const solvedPositionsBefore = order.map((w, i) => (solved.has(w) ? i : -1)).filter((i) => i >= 0);
    const solvedWordsAtThosePositionsAfter = solvedPositionsBefore.map((i) => next[i]);
    expect(new Set(solvedWordsAtThosePositionsAfter)).toEqual(solved);
    // every word is still present overall
    expect(new Set(next)).toEqual(new Set(order));
  });
});

describe("evaluateGuess", () => {
  it("is correct when all 4 words are exactly one group", () => {
    expect(evaluateGuess(["SNOW", "RAIN", "SLEET", "HAIL"], PUZZLE)).toBe("correct");
  });

  it("is correct regardless of selection order", () => {
    expect(evaluateGuess(["HAIL", "SNOW", "SLEET", "RAIN"], PUZZLE)).toBe("correct");
  });

  it("is one-away when exactly 3 of 4 belong to the same group", () => {
    expect(evaluateGuess(["SNOW", "RAIN", "SLEET", "SHIFT"], PUZZLE)).toBe("one-away");
  });

  it("is incorrect for a 2-and-2 split across two different groups (no group has 3)", () => {
    expect(evaluateGuess(["SNOW", "RAIN", "SHIFT", "TAB"], PUZZLE)).toBe("incorrect");
  });

  it("is incorrect for 4 words from 4 different groups", () => {
    expect(evaluateGuess(["SNOW", "SHIFT", "LEVEL", "JAB"], PUZZLE)).toBe("incorrect");
  });
});

describe("isDuplicateGuess", () => {
  it("matches an earlier guess regardless of selection order", () => {
    const guesses = [["SNOW", "RAIN", "SHIFT", "TAB"]];
    expect(isDuplicateGuess(["TAB", "SHIFT", "RAIN", "SNOW"], guesses)).toBe(true);
  });

  it("does not match a guess with different words", () => {
    const guesses = [["SNOW", "RAIN", "SHIFT", "TAB"]];
    expect(isDuplicateGuess(["SNOW", "RAIN", "SHIFT", "ENTER"], guesses)).toBe(false);
  });

  it("is false against an empty guess history", () => {
    expect(isDuplicateGuess(["SNOW", "RAIN", "SHIFT", "TAB"], [])).toBe(false);
  });
});

describe("solvedGroups / solvedWordSet", () => {
  it("lists solved groups in the chronological order they were solved, not level order", () => {
    const guesses = [
      ["JAB", "HOOK", "RING", "BELL"], // level 3, solved first
      ["SNOW", "RAIN", "SLEET", "HAIL"], // level 0, solved second
    ];
    const solved = solvedGroups(guesses, PUZZLE);
    expect(solved.map((g) => g.label)).toEqual(["BOXING TERMS", "WET WEATHER"]);
  });

  it("never double-counts a group even if (hypothetically) matched twice", () => {
    const guesses = [
      ["SNOW", "RAIN", "SLEET", "HAIL"],
      ["SNOW", "RAIN", "SLEET", "HAIL"],
    ];
    expect(solvedGroups(guesses, PUZZLE)).toHaveLength(1);
  });

  it("solvedWordSet is the flat set of words in every solved group", () => {
    const guesses = [["SNOW", "RAIN", "SLEET", "HAIL"]];
    expect(solvedWordSet(guesses, PUZZLE)).toEqual(new Set(["SNOW", "RAIN", "SLEET", "HAIL"]));
  });

  it("ignores incorrect/one-away guesses", () => {
    const guesses = [["SNOW", "RAIN", "SLEET", "SHIFT"]];
    expect(solvedGroups(guesses, PUZZLE)).toHaveLength(0);
  });
});

describe("countMistakes / isWon / isLost / isOver", () => {
  it("counts every non-correct guess as a mistake, correct guesses not included", () => {
    const guesses = [
      ["SNOW", "RAIN", "SLEET", "SHIFT"], // one-away: mistake
      ["SNOW", "RAIN", "SHIFT", "TAB"], // incorrect: mistake
      ["SNOW", "RAIN", "SLEET", "HAIL"], // correct: not a mistake
    ];
    expect(countMistakes(guesses, PUZZLE)).toBe(2);
  });

  it("is won once all 4 groups are solved, regardless of mistakes made along the way", () => {
    const guesses = [
      ["SNOW", "RAIN", "SLEET", "SHIFT"], // mistake 1
      ["SNOW", "RAIN", "SHIFT", "TAB"], // mistake 2
      ["SNOW", "RAIN", "SLEET", "HAIL"],
      ["SHIFT", "TAB", "ENTER", "SPACE"],
      ["LEVEL", "RACECAR", "KAYAK", "CIVIC"],
      ["JAB", "HOOK", "RING", "BELL"], // 4th and final correct guess
    ];
    expect(isWon(guesses, PUZZLE)).toBe(true);
    expect(isLost(guesses, PUZZLE)).toBe(false);
    expect(isOver(guesses, PUZZLE)).toBe(true);
    expect(countMistakes(guesses, PUZZLE)).toBe(2);
  });

  it("is lost exactly on the guess that produces the 4th mistake", () => {
    const guesses = [
      ["SNOW", "RAIN", "SLEET", "SHIFT"],
      ["SNOW", "RAIN", "SHIFT", "TAB"],
      ["SNOW", "SHIFT", "LEVEL", "JAB"],
      ["RAIN", "TAB", "RACECAR", "HOOK"],
    ];
    expect(countMistakes(guesses, PUZZLE)).toBe(MAX_MISTAKES);
    expect(isLost(guesses, PUZZLE)).toBe(true);
    expect(isWon(guesses, PUZZLE)).toBe(false);
    expect(isOver(guesses, PUZZLE)).toBe(true);
  });

  it("is not over with 3 mistakes and no win yet", () => {
    const guesses = [
      ["SNOW", "RAIN", "SLEET", "SHIFT"],
      ["SNOW", "RAIN", "SHIFT", "TAB"],
      ["SNOW", "SHIFT", "LEVEL", "JAB"],
    ];
    expect(isOver(guesses, PUZZLE)).toBe(false);
  });
});

describe("remainingGroupsByLevel", () => {
  it("returns unsolved groups sorted ascending by level, for the loss-reveal order", () => {
    const guesses = [["JAB", "HOOK", "RING", "BELL"]]; // level 3 solved
    const remaining = remainingGroupsByLevel(guesses, PUZZLE);
    expect(remaining.map((g) => g.level)).toEqual([0, 1, 2]);
  });
});

describe("buildSummary", () => {
  it("includes the title and puzzle number, and one row per guess", () => {
    const guesses = [
      ["SNOW", "RAIN", "SLEET", "HAIL"],
      ["SHIFT", "TAB", "ENTER", "SPACE"],
    ];
    const summary = buildSummary(guesses, PUZZLE, 42);
    expect(summary).toContain("Connections #42");
    expect(summary.split("\n").filter((l) => /^[🟨🟩🟦🟪]+$/.test(l))).toHaveLength(2);
  });

  it("colours each square by the word's actual group level", () => {
    const guesses = [["SNOW", "SHIFT", "LEVEL", "JAB"]]; // one word from each level, in level order
    const summary = buildSummary(guesses, PUZZLE, 1);
    expect(summary).toContain("🟨🟩🟦🟪");
  });

  it("never contains any word or group label from the puzzle, for a mix of guesses", () => {
    const guesses = [
      ["SNOW", "RAIN", "SLEET", "SHIFT"],
      ["SNOW", "RAIN", "SLEET", "HAIL"],
      ["SHIFT", "TAB", "ENTER", "SPACE"],
    ];
    const summary = buildSummary(guesses, PUZZLE, 7);
    for (const g of PUZZLE.groups) {
      expect(summary).not.toContain(g.label);
      for (const w of g.words) expect(summary).not.toContain(w);
    }
  });

  it("never contains any word or group label, across every generated day's real puzzle", () => {
    const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../content/puzzles/connections");
    const files = readdirSync(contentDir).filter((f) => f.endsWith(".json")).slice(0, 40);
    for (const file of files) {
      const { payload, reserve } = JSON.parse(readFileSync(resolve(contentDir, file), "utf8")) as {
        payload: ConnectionsPuzzle;
        reserve: ConnectionsPuzzle;
      };
      for (const puzzle of [payload, reserve]) {
        const guesses = puzzle.groups.map((g) => g.words);
        const summary = buildSummary(guesses, puzzle, 1);
        for (const g of puzzle.groups) {
          expect(summary).not.toContain(g.label);
          for (const w of g.words) expect(summary).not.toContain(w);
        }
      }
    }
  });
});

describe("state round-trips through JSON", () => {
  it("reconstructs an identical game after JSON.stringify/parse", () => {
    const state: ConnectionsState = {
      guesses: [
        ["SNOW", "RAIN", "SLEET", "SHIFT"],
        ["SNOW", "RAIN", "SLEET", "HAIL"],
      ],
      order: shuffleRemaining(allWords(PUZZLE), new Set(), () => 0.5),
    };
    const restored = JSON.parse(JSON.stringify(state)) as ConnectionsState;
    expect(restored).toEqual(state);
    expect(solvedGroups(restored.guesses, PUZZLE)).toEqual(solvedGroups(state.guesses, PUZZLE));
    expect(effectiveOrder(restored, PUZZLE, "2026-10-17")).toEqual(effectiveOrder(state, PUZZLE, "2026-10-17"));
  });
});
