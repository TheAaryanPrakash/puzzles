import { describe, it, expect } from "vitest";
import {
  rowFeedback,
  isWon,
  isLost,
  isOver,
  keyboardStates,
  hardModeViolation,
  buildSummary,
  describeGuess,
  MAX_GUESSES,
  WORD_LENGTH,
  type WordleState,
} from "./logic";

const ANSWER = "CRANE";

function state(guesses: string[], hardMode = false): WordleState {
  return { guesses, hardMode };
}

describe("isWon / isLost / isOver", () => {
  it("wins on the exact 6th guess", () => {
    const s = state(["SLATE", "TRACE", "GRADE", "CRAZE", "CRAVE", "CRANE"]);
    expect(isWon(s, ANSWER)).toBe(true);
    expect(isLost(s, ANSWER)).toBe(false);
    expect(isOver(s, ANSWER)).toBe(true);
  });

  it("loses on the 6th guess without the answer", () => {
    const s = state(["SLATE", "TRACE", "GRADE", "CRAZE", "CRAVE", "BLIMP"]);
    expect(isWon(s, ANSWER)).toBe(false);
    expect(isLost(s, ANSWER)).toBe(true);
    expect(isOver(s, ANSWER)).toBe(true);
    expect(s.guesses.length).toBe(MAX_GUESSES);
  });

  it("is neither won nor lost mid-game", () => {
    const s = state(["SLATE"]);
    expect(isOver(s, ANSWER)).toBe(false);
  });

  it("matching is case-insensitive", () => {
    const s = state(["crane"]);
    expect(isWon(s, ANSWER)).toBe(true);
  });
});

describe("rowFeedback", () => {
  it("delegates to the shared two-pass scorer (duplicate-letter case)", () => {
    expect(rowFeedback("LLAMA", "HELLO")).toEqual(["present", "present", "absent", "absent", "absent"]);
  });
});

describe("keyboardStates", () => {
  it("never downgrades a letter once it has earned a better state", () => {
    // Guess 1: A is correct (position 1). Guess 2 reuses A in a position where it's absent.
    const states = keyboardStates(["CRANE", "AXXXX"], "CRANE");
    expect(states.A).toBe("correct");
  });

  it("upgrades a letter across guesses (present, then correct)", () => {
    // R is present in guess 1 (wrong position), correct in guess 2.
    const states = keyboardStates(["RXXXX", "CRANE"], "CRANE");
    expect(states.R).toBe("correct");
  });

  it("only reports letters that have been guessed", () => {
    const states = keyboardStates(["CRANE"], "CRANE");
    expect(states.Z).toBeUndefined();
  });
});

describe("hardModeViolation", () => {
  it("allows the first guess unconditionally", () => {
    expect(hardModeViolation("SLATE", [], ANSWER)).toBeNull();
  });

  it("rejects dropping a previously-correct letter from its position", () => {
    // "CRASH" vs CRANE: C,R correct (0,1), A present (2 is A, wrong pos in CRANE? let's check)
    // CRANE = C R A N E. Guess "CRASH": C-correct,R-correct,A-correct,S-absent,H-absent.
    const previous = ["CRASH"];
    const violation = hardModeViolation("TRACE", previous, ANSWER);
    expect(violation).toBe("1st letter must be C");
  });

  it("rejects omitting a previously-present letter", () => {
    // "EARTH" vs CRANE: no letter lands in its correct position, so E, A and R are all "present"
    // (required somewhere), T and H are absent (not required). "CRYPT" contains R but not E or A.
    const previous = ["EARTH"];
    const violation = hardModeViolation("CRYPT", previous, ANSWER);
    expect(violation).toBe("Guess must contain E");
  });

  it("accepts a guess that satisfies every constraint", () => {
    const previous = ["CRASH"]; // C,R,A correct; S,H absent
    expect(hardModeViolation("CRANE", previous, ANSWER)).toBeNull();
  });

  it("never enforces a grey (absent) letter", () => {
    // "CRASH": S and H are absent. A guess that omits them entirely must still be fine.
    const previous = ["CRASH"];
    expect(hardModeViolation("CRAZE", previous, ANSWER)).toBeNull();
  });

  it("checks position constraints before contains constraints, lowest index first", () => {
    // Two different violations are possible; position violation at index 0 should win.
    const previous = ["CRASH"]; // requires C@0, R@1, A@2
    const violation = hardModeViolation("ZZZZZ", previous, ANSWER);
    expect(violation).toBe("1st letter must be C");
  });
});

describe("buildSummary", () => {
  it("never contains the answer word itself, win or lose", () => {
    for (const guesses of [["SLATE", "CRANE"], ["SLATE", "TRACE", "GRADE", "CRAZE", "CRAVE", "BLIMP"]]) {
      const summary = buildSummary(state(guesses), ANSWER, 1);
      expect(summary.toUpperCase()).not.toContain(ANSWER);
    }
  });

  it("shows the guess count on a win and X on a loss", () => {
    const won = state(["SLATE", "TRACE", "CRANE"]);
    expect(buildSummary(won, ANSWER, 5)).toContain(`3/${MAX_GUESSES}`);

    const lost = state(["SLATE", "TRACE", "GRADE", "CRAZE", "CRAVE", "BLIMP"]);
    expect(buildSummary(lost, ANSWER, 5)).toContain(`X/${MAX_GUESSES}`);
  });

  it("has exactly one grid row per guess, not per MAX_GUESSES", () => {
    const s = state(["SLATE", "TRACE"]);
    const summary = buildSummary(s, ANSWER, 1);
    const grid = summary.split("\n\n")[1];
    expect(grid.split("\n").length).toBe(2);
  });

  it("includes the puzzle number and site name", () => {
    const s = state(["CRANE"]);
    const summary = buildSummary(s, ANSWER, 42);
    expect(summary).toContain("#42");
    expect(summary).toContain("Sansita's Puzzles");
  });
});

describe("describeGuess", () => {
  it("announces every letter with its feedback, in order", () => {
    const text = describeGuess("CRASH", ANSWER, 1);
    expect(text).toBe(
      "Guess 1: C, correct. R, correct. A, correct. S, absent. H, absent.",
    );
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical game, including hardMode", () => {
    const s = state(["SLATE", "TRACE"], true);
    const restored = JSON.parse(JSON.stringify(s)) as WordleState;
    expect(restored).toEqual(s);
    expect(isOver(restored, ANSWER)).toBe(isOver(s, ANSWER));
  });
});

describe("the {} gotcha", () => {
  it("merging DEFAULT_STATE with {} yields a valid empty state", async () => {
    const { DEFAULT_STATE } = await import("./logic");
    const merged: WordleState = { ...DEFAULT_STATE, ...({} as Partial<WordleState>) };
    expect(merged.guesses).toEqual([]);
    expect(merged.hardMode).toBe(false);
    expect(isOver(merged, ANSWER)).toBe(false);
  });
});

describe("WORD_LENGTH", () => {
  it("is 5", () => {
    expect(WORD_LENGTH).toBe(5);
  });
});
