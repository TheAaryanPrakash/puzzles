import { describe, it, expect } from "vitest";
import { bfsDistances, pickDayPair, MIN_SHORTEST_LENGTH, MAX_SHORTEST_LENGTH } from "./generate";
import { mulberry32 } from "../../src/lib/daily";

// Same small world as logic.test.ts's chain, extended with an unreachable island.
const ADJACENCY: Record<string, string[]> = {
  A: ["B"],
  B: ["A", "C"],
  C: ["B", "D"],
  D: ["C", "E"],
  E: ["D", "F"],
  F: ["E", "G"],
  G: ["F", "H"],
  H: ["G"],
  ISLAND: [],
};

describe("bfsDistances", () => {
  it("gives distance 0 to the start node itself", () => {
    expect(bfsDistances(ADJACENCY, "A").get("A")).toBe(0);
  });

  it("computes the correct edge distance along a chain", () => {
    const distances = bfsDistances(ADJACENCY, "A");
    expect(distances.get("B")).toBe(1);
    expect(distances.get("H")).toBe(7);
  });

  it("never includes an unreachable node", () => {
    const distances = bfsDistances(ADJACENCY, "A");
    expect(distances.has("ISLAND")).toBe(false);
  });
});

describe("pickDayPair", () => {
  const candidates = Object.keys(ADJACENCY).filter((c) => ADJACENCY[c].length > 0);

  it("only ever returns a pair within the required shortestLength range", () => {
    for (let seed = 0; seed < 50; seed++) {
      const pair = pickDayPair(ADJACENCY, candidates, mulberry32(seed), new Set());
      expect(pair).not.toBeNull();
      expect(pair!.shortestLength).toBeGreaterThanOrEqual(MIN_SHORTEST_LENGTH);
      expect(pair!.shortestLength).toBeLessThanOrEqual(MAX_SHORTEST_LENGTH);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = pickDayPair(ADJACENCY, candidates, mulberry32(42), new Set());
    const b = pickDayPair(ADJACENCY, candidates, mulberry32(42), new Set());
    expect(a).toEqual(b);
  });

  it("never returns a pair already in usedPairs, in either order", () => {
    const first = pickDayPair(ADJACENCY, candidates, mulberry32(7), new Set())!;
    const used = new Set([[first.start, first.end].sort().join("-")]);
    for (let seed = 0; seed < 50; seed++) {
      const pair = pickDayPair(ADJACENCY, candidates, mulberry32(seed), used);
      if (!pair) continue;
      expect([pair.start, pair.end].sort().join("-")).not.toBe(
        [first.start, first.end].sort().join("-"),
      );
    }
  });

  it("never includes an isolated country as start or end", () => {
    for (let seed = 0; seed < 20; seed++) {
      const pair = pickDayPair(ADJACENCY, candidates, mulberry32(seed), new Set());
      expect(pair!.start).not.toBe("ISLAND");
      expect(pair!.end).not.toBe("ISLAND");
    }
  });

  it("returns null when every possible pair is already used", () => {
    // In this 9-node chain the only nodes at distance 4-8 from any start are a handful of pairs;
    // exhaust all of them and confirm the function fails closed rather than returning a wrong one.
    const allPairs = new Set<string>();
    for (const a of candidates) {
      const distances = bfsDistances(ADJACENCY, a);
      for (const [b, d] of distances) {
        if (b !== a && d >= MIN_SHORTEST_LENGTH + 1 && d <= MAX_SHORTEST_LENGTH + 1) {
          allPairs.add([a, b].sort().join("-"));
        }
      }
    }
    const pair = pickDayPair(ADJACENCY, candidates, mulberry32(1), allPairs);
    expect(pair).toBeNull();
  });
});
