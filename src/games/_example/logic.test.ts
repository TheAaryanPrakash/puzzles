import { describe, it, expect } from "vitest";
import {
  feedbackFor,
  isWon,
  isLost,
  isOver,
  buildSummary,
  MAX_GUESSES,
  type ExampleState,
} from "./logic";

describe("feedbackFor", () => {
  it("reports correct, higher, lower", () => {
    expect(feedbackFor(10, 10)).toBe("correct");
    expect(feedbackFor(5, 10)).toBe("higher");
    expect(feedbackFor(15, 10)).toBe("lower");
  });
});

describe("isWon / isLost / isOver", () => {
  it("is won once the secret has been guessed", () => {
    const state: ExampleState = { guesses: [3, 7, 10] };
    expect(isWon(state, 10)).toBe(true);
    expect(isLost(state, 10)).toBe(false);
    expect(isOver(state, 10)).toBe(true);
  });

  it("is lost after MAX_GUESSES without the secret", () => {
    const state: ExampleState = { guesses: Array.from({ length: MAX_GUESSES }, (_, i) => i + 1) };
    expect(isWon(state, 99)).toBe(false);
    expect(isLost(state, 99)).toBe(true);
    expect(isOver(state, 99)).toBe(true);
  });

  it("is neither won nor lost mid-game", () => {
    const state: ExampleState = { guesses: [1] };
    expect(isOver(state, 99)).toBe(false);
  });
});

describe("state round-trips through JSON", () => {
  it("restores to an identical game", () => {
    const state: ExampleState = { guesses: [4, 12, 9] };
    const restored = JSON.parse(JSON.stringify(state)) as ExampleState;
    expect(restored).toEqual(state);
    expect(isWon(restored, 9)).toBe(isWon(state, 9));
  });
});

describe("buildSummary", () => {
  it("never contains the secret number", () => {
    for (const secret of [1, 7, 13, 20]) {
      const state: ExampleState = { guesses: [secret === 1 ? 2 : 1, secret] };
      const summary = buildSummary(state, secret, 42);
      expect(summary).not.toContain(String(secret));
    }
  });

  it("shows the guess count on a win and X on a loss", () => {
    const won: ExampleState = { guesses: [1, 2, 10] };
    expect(buildSummary(won, 10, 1)).toContain("3/4");

    const lost: ExampleState = { guesses: [1, 2, 3, 4] };
    expect(buildSummary(lost, 99, 1)).toContain("X/4");
  });
});
