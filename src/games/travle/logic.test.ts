import { describe, it, expect } from "vitest";
import {
  allowedGuessesFor,
  isWon,
  isLost,
  isOver,
  classifyGuesses,
  rejectReasonFor,
  resolveCountryName,
  flagEmoji,
  buildSummary,
  DEFAULT_STATE,
  type TravlePuzzle,
  type TravleState,
} from "./logic";

// A small, hand-built world for pure-logic tests — independent of the real 236-country graph
// (which borders.test.ts already covers). Layout:
//
//   A - B - C - D - E      (a clean chain from A to E)
//       |
//       F - G              (a side branch off B, unrelated to the A..E chain)
//
//   H (isolated, no neighbors at all)
const ADJACENCY: Record<string, string[]> = {
  A: ["B"],
  B: ["A", "C", "F"],
  C: ["B", "D"],
  D: ["C", "E"],
  E: ["D"],
  F: ["B", "G"],
  G: ["F"],
  H: [],
};

const PUZZLE: TravlePuzzle = { start: "A", end: "E", shortestLength: 3, allowedGuesses: 7 };

function state(guesses: string[]): TravleState {
  return { guesses };
}

describe("allowedGuessesFor", () => {
  it("matches every bracket boundary in the official table", () => {
    expect(allowedGuessesFor(3)).toBe(7); // 3 + 4
    expect(allowedGuessesFor(4)).toBe(9); // 4 + 5
    expect(allowedGuessesFor(6)).toBe(11); // 6 + 5
    expect(allowedGuessesFor(7)).toBe(13); // 7 + 6
    expect(allowedGuessesFor(9)).toBe(15); // 9 + 6
    expect(allowedGuessesFor(10)).toBe(17); // 10 + 7
    expect(allowedGuessesFor(12)).toBe(19); // 12 + 7
    expect(allowedGuessesFor(13)).toBe(21); // 13 + 8
  });
});

describe("isWon / isLost / isOver", () => {
  it("is not won before the chain is complete", () => {
    expect(isWon(state(["B", "C"]), PUZZLE, ADJACENCY)).toBe(false);
  });

  it("wins by chaining purely from start outward", () => {
    expect(isWon(state(["B", "C", "D"]), PUZZLE, ADJACENCY)).toBe(true);
  });

  it("wins regardless of guess order, as long as the chain completes", () => {
    expect(isWon(state(["D", "B", "C"]), PUZZLE, ADJACENCY)).toBe(true);
  });

  it("wins by two floating islands merging into one start-to-end component", () => {
    // B (touches start A) and D (touches end E) guessed first: two separate islands.
    expect(isWon(state(["B", "D"]), PUZZLE, ADJACENCY)).toBe(false);
    // C bridges them on the final guess.
    expect(isWon(state(["B", "D", "C"]), PUZZLE, ADJACENCY)).toBe(true);
  });

  it("an unrelated branch never wins the puzzle", () => {
    expect(isWon(state(["F", "G"]), PUZZLE, ADJACENCY)).toBe(false);
  });

  it("is lost once guesses reach the allowance without completing the chain", () => {
    // 7 guesses (the allowance), none of which ever reach end E.
    const incomplete = state(["F", "G", "B", "F", "G", "B", "F"]);
    expect(incomplete.guesses.length).toBe(PUZZLE.allowedGuesses);
    expect(isLost(incomplete, PUZZLE, ADJACENCY)).toBe(true);
    expect(isOver(incomplete, PUZZLE, ADJACENCY)).toBe(true);
  });

  it("is not lost below the allowance, even with zero progress", () => {
    expect(isLost(state(["G"]), PUZZLE, ADJACENCY)).toBe(false);
  });

  it("a completed win at exactly the allowance is a win, not a loss", () => {
    const guesses = ["B", "C", "D"];
    expect(guesses.length).toBeLessThanOrEqual(PUZZLE.allowedGuesses);
    expect(isWon(state(guesses), PUZZLE, ADJACENCY)).toBe(true);
    expect(isLost(state(guesses), PUZZLE, ADJACENCY)).toBe(false);
  });
});

describe("classifyGuesses", () => {
  it("marks a guess touching start as on-path", () => {
    expect(classifyGuesses(state(["B"]), PUZZLE, ADJACENCY).B).toBe("on-path");
  });

  it("marks a guess touching end as on-path", () => {
    expect(classifyGuesses(state(["D"]), PUZZLE, ADJACENCY).D).toBe("on-path");
  });

  it("marks a floating pair connected to each other, but not to start or end, as adjacent", () => {
    const result = classifyGuesses(state(["F", "G"]), PUZZLE, ADJACENCY);
    expect(result.F).toBe("adjacent");
    expect(result.G).toBe("adjacent");
  });

  it("marks a fully isolated guess as unconnected", () => {
    expect(classifyGuesses(state(["H"]), PUZZLE, ADJACENCY).H).toBe("unconnected");
  });

  it("re-classifies a guess as on-path once a later guess bridges it to an anchor", () => {
    // F alone doesn't touch start A or end E directly, so it's unconnected on its own...
    const before = classifyGuesses(state(["F"]), PUZZLE, ADJACENCY);
    expect(before.F).toBe("unconnected");
    // ...but once B (which touches start A) is also guessed, F joins that anchored component.
    const after = classifyGuesses(state(["F", "B"]), PUZZLE, ADJACENCY);
    expect(after.F).toBe("on-path");
    expect(after.B).toBe("on-path");
  });

  it("an adjacent-only guess becomes on-path once it joins the anchored chain", () => {
    // G only touches F; neither touches start/end yet, so both are "adjacent".
    const isolated: Record<string, string[]> = { ...ADJACENCY, F: ["G"] }; // detach F from B
    const before = classifyGuesses(state(["F", "G"]), PUZZLE, isolated);
    expect(before.F).toBe("adjacent");
    expect(before.G).toBe("adjacent");
  });
});

describe("rejectReasonFor", () => {
  it("rejects an unresolved (unknown) country", () => {
    expect(rejectReasonFor(null, DEFAULT_STATE, PUZZLE)).toBe("unknown-country");
  });

  it("rejects guessing the start or end country directly", () => {
    expect(rejectReasonFor("A", DEFAULT_STATE, PUZZLE)).toBe("is-endpoint");
    expect(rejectReasonFor("E", DEFAULT_STATE, PUZZLE)).toBe("is-endpoint");
  });

  it("rejects a duplicate guess", () => {
    expect(rejectReasonFor("B", state(["B"]), PUZZLE)).toBe("duplicate");
  });

  it("accepts a fresh, valid guess", () => {
    expect(rejectReasonFor("C", state(["B"]), PUZZLE)).toBeNull();
  });
});

describe("resolveCountryName", () => {
  const names = {
    GB: { name: "United Kingdom", aliases: ["UK", "Britain"] },
    FR: { name: "France", aliases: [] },
  };

  it("matches the canonical name, case-insensitively", () => {
    expect(resolveCountryName("france", names)).toBe("FR");
    expect(resolveCountryName("FRANCE", names)).toBe("FR");
  });

  it("matches an alias identically to the canonical name", () => {
    expect(resolveCountryName("UK", names)).toBe("GB");
    expect(resolveCountryName("uk", names)).toBe("GB");
  });

  it("trims whitespace", () => {
    expect(resolveCountryName("  France  ", names)).toBe("FR");
  });

  it("returns null for no match", () => {
    expect(resolveCountryName("Narnia", names)).toBeNull();
    expect(resolveCountryName("", names)).toBeNull();
  });
});

describe("flagEmoji", () => {
  it("builds a regional-indicator flag from an iso_a2 code", () => {
    expect(flagEmoji("FR")).toBe("🇫🇷");
    expect(flagEmoji("us")).toBe("🇺🇸");
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical game", () => {
    const original = state(["B", "D", "C"]);
    const restored = JSON.parse(JSON.stringify(original)) as TravleState;
    expect(restored).toEqual(original);
    expect(isWon(restored, PUZZLE, ADJACENCY)).toBe(isWon(original, PUZZLE, ADJACENCY));
  });
});

describe("buildSummary", () => {
  it("never contains a guessed country's code", () => {
    const won = state(["B", "C", "D"]);
    const summary = buildSummary(won, PUZZLE, ADJACENCY, 12);
    for (const guess of won.guesses) {
      expect(summary).not.toContain(guess);
    }
  });

  it("includes the puzzle number and a win/loss-appropriate grid", () => {
    const won = state(["B", "C", "D"]);
    const summary = buildSummary(won, PUZZLE, ADJACENCY, 12);
    expect(summary).toContain("#12");
    expect(summary).toContain("Perfect route!");
    expect(summary).toContain("🟩");

    const lost = state(["F", "G", "F", "F", "F", "F", "F"]);
    const lostSummary = buildSummary(lost, PUZZLE, ADJACENCY, 12);
    expect(lostSummary).toContain("X/7");
  });

  it("shows a non-perfect but won route as +N", () => {
    const won = state(["B", "F", "C", "D"]); // one wasted guess (F) beyond the shortest route
    const summary = buildSummary(won, PUZZLE, ADJACENCY, 1);
    expect(summary).toContain("+1");
  });
});
