import { describe, expect, it } from "vitest";
import {
  BOARD_COUNT,
  MAX_GUESSES,
  WORD_LENGTH,
  boardGuesses,
  boardSolvedAt,
  buildSummary,
  combinedKeyStates,
  DEFAULT_STATE,
  isBoardSolved,
  isLost,
  isOver,
  isValidGuessWord,
  isWon,
  keyStatesForBoard,
  scoreForBoard,
  type QuordleState,
} from "./logic";

const ANSWERS = ["CRANE", "STOMP", "BUILD", "FUNKY"] as const;

function stateOf(guesses: string[]): QuordleState {
  return { guesses };
}

describe("constants", () => {
  it("guess budget is boards + 5", () => {
    expect(BOARD_COUNT).toBe(4);
    expect(WORD_LENGTH).toBe(5);
    expect(MAX_GUESSES).toBe(9);
  });
});

describe("scoreForBoard", () => {
  it("scores duplicate letters independently per board (reuses the shared two-pass algorithm)", () => {
    // "SASSY" guessed against "CRASS": not re-testing scoreGuess itself, just that it's wired in.
    expect(scoreForBoard("SASSY", "CRASS")).toEqual([
      "present",
      "present",
      "absent",
      "correct",
      "absent",
    ]);
  });
});

describe("boardSolvedAt / isBoardSolved", () => {
  it("is null/false before the answer is guessed", () => {
    expect(boardSolvedAt(["WRONG"], "CRANE")).toBeNull();
    expect(isBoardSolved(["WRONG"], "CRANE")).toBe(false);
  });

  it("is the 1-based guess index once solved", () => {
    expect(boardSolvedAt(["WRONG", "CRANE", "LATER"], "CRANE")).toBe(2);
    expect(isBoardSolved(["WRONG", "CRANE", "LATER"], "CRANE")).toBe(true);
  });

  it("a guess matching one board's answer only solves that board, and still scores against the rest", () => {
    const state = stateOf(["CRANE"]);
    expect(isBoardSolved(state.guesses, ANSWERS[0])).toBe(true);
    expect(isBoardSolved(state.guesses, ANSWERS[1])).toBe(false);
    expect(isBoardSolved(state.guesses, ANSWERS[2])).toBe(false);
    expect(isBoardSolved(state.guesses, ANSWERS[3])).toBe(false);
    // "CRANE" vs "STOMP" is still scored (all absent/wrong-position letters), not skipped.
    expect(scoreForBoard("CRANE", ANSWERS[1])).toHaveLength(5);
  });
});

describe("boardGuesses (what a board actually renders)", () => {
  it("freezes at the solving guess — later shared guesses don't appear on a solved board", () => {
    const guesses = ["WRONG", "CRANE", "LATER", "AGAIN"];
    expect(boardGuesses(guesses, "CRANE")).toEqual(["WRONG", "CRANE"]);
  });

  it("shows every guess so far for a board that's still unsolved", () => {
    const guesses = ["WRONG", "AGAIN"];
    expect(boardGuesses(guesses, "CRANE")).toEqual(["WRONG", "AGAIN"]);
  });
});

describe("win / loss", () => {
  it("wins only once every board is solved", () => {
    const almost = stateOf([ANSWERS[0], ANSWERS[1], ANSWERS[2]]);
    expect(isWon(almost, ANSWERS)).toBe(false);
    const all = stateOf([...ANSWERS]);
    expect(isWon(all, ANSWERS)).toBe(true);
  });

  it("wins on exactly the 9th (last) guess", () => {
    const guesses = ["WRONG", "WRONG", "WRONG", "WRONG", "WRONG", ANSWERS[0], ANSWERS[1], ANSWERS[2], ANSWERS[3]];
    expect(guesses).toHaveLength(MAX_GUESSES);
    const state = stateOf(guesses);
    expect(isWon(state, ANSWERS)).toBe(true);
    expect(isLost(state, ANSWERS)).toBe(false);
    expect(isOver(state, ANSWERS)).toBe(true);
  });

  it("loses once the shared guess count hits the cap with a board still unsolved", () => {
    const guesses = Array.from({ length: MAX_GUESSES }, (_, i) => `WRON${i}`.slice(0, 5));
    const state = stateOf([ANSWERS[0], ANSWERS[1], ANSWERS[2], ...guesses].slice(0, MAX_GUESSES));
    expect(state.guesses).toHaveLength(MAX_GUESSES);
    expect(isWon(state, ANSWERS)).toBe(false);
    expect(isLost(state, ANSWERS)).toBe(true);
    expect(isOver(state, ANSWERS)).toBe(true);
  });

  it("is not over before the cap with boards still unsolved", () => {
    const state = stateOf(["WRONG", "WRONG"]);
    expect(isOver(state, ANSWERS)).toBe(false);
  });

  it("the shared list keeps growing and keeps being scored after some boards are solved", () => {
    const state = stateOf([ANSWERS[0], "WRONG", "AGAIN"]);
    expect(isBoardSolved(state.guesses, ANSWERS[0])).toBe(true);
    expect(isOver(state, ANSWERS)).toBe(false);
    expect(boardGuesses(state.guesses, ANSWERS[1])).toEqual(state.guesses);
  });
});

describe("keyStatesForBoard", () => {
  it("never downgrades a letter once it's shown correct", () => {
    // First guess puts "C" absent somewhere-else-context is irrelevant here: use a direct case.
    const states1 = keyStatesForBoard(["CRANE"], "CRANE");
    expect(states1.C).toBe("correct");

    // A later guess that scores "C" as absent against this board must not override the correct mark.
    const states2 = keyStatesForBoard(["CRANE", "SCOWL"], "CRANE");
    expect(states2.C).toBe("correct");
  });

  it("upgrades present to correct but never the reverse", () => {
    // "CRANE" guessed against "RANCE" scores C as present (wrong spot).
    const afterPresent = keyStatesForBoard(["CRANE"], "RANCE");
    expect(afterPresent.C).toBe("present");
  });
});

describe("combinedKeyStates (quadrant keyboard)", () => {
  // Letter-disjoint fixture boards keep the per-letter arithmetic unambiguous to hand-check.
  const DISJOINT = ["ABCDE", "FGHIJ", "KLMNO", "PQRST"] as const;

  it("returns one state per board, in board order, keyed by letter", () => {
    const state = stateOf(["ABCDE"]); // solves board 0; still scored against the other 3
    const keys = combinedKeyStates(state, DISJOINT);
    expect(keys.A).toEqual(["correct", "absent", "absent", "absent"]);
    expect(keys.A).toHaveLength(BOARD_COUNT);
    expect(keys.F).toEqual(["unused", "unused", "unused", "unused"]); // never guessed at all
  });

  it("freezes a solved board's keyboard contribution at its solving guess", () => {
    const state = stateOf(["ABCDE", "PQRST"]); // board 0 solved by guess 1, board 3 by guess 2
    const keys = combinedKeyStates(state, DISJOINT);
    // Board 0 is frozen at guess 1, so "P" (only in guess 2) never reaches its contribution.
    expect(keys.P[0]).toBe("unused");
    expect(keys.P[3]).toBe("correct");
  });
});

describe("isValidGuessWord", () => {
  const validGuesses = new Set(["CRANE", "STOMP", "ABOUT"]);

  it("accepts a known 5-letter word, case-insensitively", () => {
    expect(isValidGuessWord("crane", validGuesses)).toBe(true);
    expect(isValidGuessWord("CRANE", validGuesses)).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isValidGuessWord("CRAN", validGuesses)).toBe(false);
    expect(isValidGuessWord("CRANES", validGuesses)).toBe(false);
  });

  it("rejects a 5-letter string that isn't a real word in the list", () => {
    expect(isValidGuessWord("ZZZZZ", validGuesses)).toBe(false);
  });
});

describe("buildSummary (spoiler-free)", () => {
  it("never contains any answer, win or loss", () => {
    const won = stateOf([...ANSWERS]);
    const lost = stateOf(Array.from({ length: MAX_GUESSES }, () => "WRONG"));
    for (const state of [won, lost]) {
      const summary = buildSummary(state, ANSWERS, 1);
      for (const answer of ANSWERS) {
        expect(summary.toUpperCase()).not.toContain(answer);
      }
    }
  });

  it("shows a 🟥 for an unsolved board and a digit for a solved one, in board order", () => {
    const state = stateOf([ANSWERS[0], ANSWERS[1]]);
    const summary = buildSummary(state, ANSWERS, 42);
    expect(summary).toContain("#42");
    expect(summary).toContain("1️⃣"); // board 0 solved on guess 1
    expect(summary).toContain("2️⃣"); // board 1 solved on guess 2
    expect(summary).toContain("🟥"); // boards 2 and 3 unsolved
  });

  it("marks a win distinctly from a loss", () => {
    const won = buildSummary(stateOf([...ANSWERS]), ANSWERS, 1);
    const lost = buildSummary(stateOf(Array.from({ length: MAX_GUESSES }, () => "WRONG")), ANSWERS, 1);
    expect(won).toContain("🎉");
    expect(lost).toContain("X/9");
  });
});

describe("state survives a JSON round-trip", () => {
  it("produces an identical game after serialize/restore", () => {
    const state = stateOf([ANSWERS[0], "WRONG", ANSWERS[1]]);
    const restored = JSON.parse(JSON.stringify(state)) as QuordleState;

    expect(restored).toEqual(state);
    expect(isWon(restored, ANSWERS)).toBe(isWon(state, ANSWERS));
    expect(isOver(restored, ANSWERS)).toBe(isOver(state, ANSWERS));
    expect(combinedKeyStates(restored, ANSWERS)).toEqual(combinedKeyStates(state, ANSWERS));
    expect(buildSummary(restored, ANSWERS, 7)).toBe(buildSummary(state, ANSWERS, 7));
  });

  it("DEFAULT_STATE is itself a valid, empty, JSON-safe state", () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_STATE))).toEqual({ guesses: [] });
    expect(isOver(DEFAULT_STATE, ANSWERS)).toBe(false);
  });
});
