import { describe, it, expect } from "vitest";
import { sortByScore } from "./FriendsBoard";

describe("sortByScore", () => {
  it("orders scored entries ascending — fastest time or fewest guesses first", () => {
    const entries = [{ name: "B", score: 30 }, { name: "A", score: 10 }, { name: "C", score: 20 }];
    expect(sortByScore(entries).map((e) => e.name)).toEqual(["A", "C", "B"]);
  });

  it("sinks entries with no score below every scored entry", () => {
    const entries = [
      { name: "Lost1", score: undefined },
      { name: "Fast", score: 5 },
      { name: "Slow", score: 50 },
      { name: "Lost2", score: undefined },
    ];
    expect(sortByScore(entries).map((e) => e.name)).toEqual(["Fast", "Slow", "Lost1", "Lost2"]);
  });

  it("keeps the relative order of tied scores and of entries with no score (stable)", () => {
    const entries = [
      { name: "A", score: 10 },
      { name: "B", score: 10 },
      { name: "LostFirst", score: undefined },
      { name: "LostSecond", score: undefined },
    ];
    expect(sortByScore(entries).map((e) => e.name)).toEqual(["A", "B", "LostFirst", "LostSecond"]);
  });

  it("handles an empty list", () => {
    expect(sortByScore([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const entries = [{ name: "B", score: 2 }, { name: "A", score: 1 }];
    const copy = [...entries];
    sortByScore(entries);
    expect(entries).toEqual(copy);
  });
});
