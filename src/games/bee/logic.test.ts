import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATE,
  RANKS,
  GENIUS_INDEX,
  buildSummary,
  initialOuterOrder,
  isPangram,
  isQueenBee,
  normalizeWord,
  rankFor,
  reachedGenius,
  scoreWord,
  totalScore,
  validateWord,
  type BeePuzzle,
} from "./logic";

// A small, self-contained puzzle: center G, outer A D E N R T.
// Letters: A D E G N R T. Answers chosen so scoring/pangram/rank math is easy to hand-check.
const puzzle: BeePuzzle = {
  center: "G",
  outer: ["A", "D", "E", "N", "R", "T"],
  answers: ["GATE", "GRADE", "GARDEN", "GRANTED", "DRAGNET"],
  pangrams: ["GRANTED", "DRAGNET"],
  maxScore: scoreAll(),
};

function scoreAll(): number {
  // GATE=1, GRADE=5, GARDEN=6, GRANTED=7+7=14, DRAGNET=7+7=14 → 40
  return 1 + 5 + 6 + 14 + 14;
}

describe("normalizeWord", () => {
  it("upper-cases and strips non-letters", () => {
    expect(normalizeWord("  gate! ")).toBe("GATE");
    expect(normalizeWord("Grade123")).toBe("GRADE");
  });
});

describe("scoreWord / isPangram", () => {
  it("scores a 4-letter word as exactly 1 point (edge case 7)", () => {
    expect(scoreWord("GATE", puzzle)).toBe(1);
  });
  it("scores longer non-pangram words as 1 point per letter", () => {
    expect(scoreWord("GRADE", puzzle)).toBe(5);
    expect(scoreWord("GARDEN", puzzle)).toBe(6);
  });
  it("flags a word using all 7 letters as a pangram and adds +7 (edge case 6)", () => {
    expect(isPangram("GRANTED", puzzle)).toBe(true);
    expect(scoreWord("GRANTED", puzzle)).toBe(7 + 7);
  });
  it("does not flag a word missing one of the 7 letters as a pangram", () => {
    expect(isPangram("GARDEN", puzzle)).toBe(false);
  });
});

describe("validateWord", () => {
  it("rejects words shorter than 4 letters before checking the dictionary (edge case 1)", () => {
    expect(validateWord("GAD", puzzle, [])).toEqual({ ok: false, reason: "too-short" });
  });
  it("rejects a word using a letter outside the 7 (edge case 3)", () => {
    expect(validateWord("GATES", puzzle, [])).toEqual({ ok: false, reason: "invalid-letter" });
  });
  it("rejects a word missing the center letter (edge case 2)", () => {
    expect(validateWord("DARE", puzzle, [])).toEqual({ ok: false, reason: "missing-center" });
  });
  it("rejects a word using only valid letters, with the center, but not in the answer list (edge case 4)", () => {
    // "GREAT" uses G,R,E,A,T — all within the 7 letters, has the center G — but isn't in `answers`.
    expect(validateWord("GREAT", puzzle, [])).toEqual({ ok: false, reason: "not-in-word-list" });
  });
  it("rejects a word already found (edge case 5)", () => {
    expect(validateWord("gate", puzzle, ["GATE"])).toEqual({ ok: false, reason: "already-found" });
  });
  it("accepts a valid new word, normalized to uppercase (edge case 8: case-insensitive)", () => {
    expect(validateWord("gAtE", puzzle, [])).toEqual({ ok: true, word: "GATE" });
  });
});

describe("totalScore / rankFor", () => {
  it("sums scores for every found word", () => {
    expect(totalScore(["GATE", "GRADE"], puzzle)).toBe(1 + 5);
  });
  it("tapping Finish with 0 words found ranks Beginner at score 0 (edge case 10)", () => {
    const status = rankFor(0, puzzle);
    expect(status.rank.name).toBe("Beginner");
    expect(status.score).toBe(0);
  });
  it("a score exactly on a threshold counts as reaching that rank, not the one below (edge case 14)", () => {
    const geniusPoints = Math.ceil(puzzle.maxScore * 0.7); // 28
    const status = rankFor(geniusPoints, puzzle);
    expect(status.rank.name).toBe("Genius");
  });
  it("one point below the Genius threshold stays at the rank below", () => {
    const geniusPoints = Math.ceil(puzzle.maxScore * 0.7);
    const status = rankFor(geniusPoints - 1, puzzle);
    expect(status.rank.name).not.toBe("Genius");
  });
  it("reaching every answer's points ranks Queen Bee", () => {
    const status = rankFor(puzzle.maxScore, puzzle);
    expect(status.rank.name).toBe("Queen Bee");
    expect(status.pointsToNext).toBeNull();
  });
});

describe("reachedGenius (won/lost at finish)", () => {
  it("is false below the Genius threshold", () => {
    expect(reachedGenius(Math.ceil(puzzle.maxScore * 0.7) - 1, puzzle)).toBe(false);
  });
  it("is true at or above the Genius threshold", () => {
    expect(reachedGenius(Math.ceil(puzzle.maxScore * 0.7), puzzle)).toBe(true);
    expect(reachedGenius(puzzle.maxScore, puzzle)).toBe(true);
  });
});

describe("isQueenBee", () => {
  it("is true only once every answer has been found (edge case 9)", () => {
    expect(isQueenBee(puzzle.answers.slice(0, -1), puzzle)).toBe(false);
    expect(isQueenBee(puzzle.answers, puzzle)).toBe(true);
  });
});

describe("buildSummary (spoiler-free share text, edge case 12)", () => {
  it("never contains any answer word", () => {
    const found = ["GATE", "GRANTED"];
    const summary = buildSummary(found, puzzle, 12);
    for (const answer of puzzle.answers) {
      expect(summary).not.toContain(answer);
    }
  });
  it("includes rank, score, word count and pangram count", () => {
    const found = ["GATE", "GRANTED"];
    const summary = buildSummary(found, puzzle, 12);
    expect(summary).toContain("Spelling Bee #12");
    expect(summary).toContain(`${totalScore(found, puzzle)}/${puzzle.maxScore}`);
    expect(summary).toContain(`${found.length}/${puzzle.answers.length}`);
    expect(summary).toContain("1 pangram");
  });
});

describe("state restorability (edge cases 11 and 13)", () => {
  it("serializing mid-game state to JSON and restoring it reproduces the same score and rank", () => {
    const state = { found: ["GATE", "GRADE"] };
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(totalScore(restored.found, puzzle)).toBe(totalScore(state.found, puzzle));
    expect(rankFor(totalScore(restored.found, puzzle), puzzle)).toEqual(
      rankFor(totalScore(state.found, puzzle), puzzle),
    );
  });
  it("merging DEFAULT_STATE with the `{}` play state right after start() never crashes", () => {
    const playState = {}; // what `play.state` briefly is right after start()
    const state = { ...DEFAULT_STATE, ...playState };
    expect(state.found).toEqual([]);
    expect(() => totalScore(state.found, puzzle)).not.toThrow();
  });
});

describe("initialOuterOrder", () => {
  it("is deterministic for the same puzzle and date", () => {
    expect(initialOuterOrder(puzzle, "2026-10-17")).toEqual(initialOuterOrder(puzzle, "2026-10-17"));
  });
  it("is a permutation of the outer letters", () => {
    expect(initialOuterOrder(puzzle, "2026-10-17").slice().sort()).toEqual(
      puzzle.outer.slice().sort(),
    );
  });
  it("differs across different dates (not always alphabetical)", () => {
    const a = initialOuterOrder(puzzle, "2026-10-17");
    const b = initialOuterOrder(puzzle, "2026-11-20");
    expect(a).not.toEqual(b);
  });
});

describe("rank ladder shape", () => {
  it("is sorted ascending by percentage and ends at Queen Bee = 100%", () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].pct).toBeGreaterThan(RANKS[i - 1].pct);
    expect(RANKS[RANKS.length - 1]).toEqual({ name: "Queen Bee", pct: 1 });
  });
  it("Genius sits one rung below Queen Bee", () => {
    expect(GENIUS_INDEX).toBe(RANKS.length - 2);
  });
});
