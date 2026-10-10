import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { buildAdjacencyFromTopology, BORDER_FIXES, type CountryTopology } from "./borders";

let adjacency: Record<string, string[]>;

beforeAll(() => {
  const topology = JSON.parse(
    readFileSync("public/assets/shared/countries.json", "utf8"),
  ) as CountryTopology;
  adjacency = buildAdjacencyFromTopology(topology);
});

describe("buildAdjacencyFromTopology", () => {
  it("is symmetric: every edge appears in both directions", () => {
    for (const [code, neighborList] of Object.entries(adjacency)) {
      for (const neighbor of neighborList) {
        expect(adjacency[neighbor]).toContain(code);
      }
    }
  });

  it("has no self-loops", () => {
    for (const [code, neighborList] of Object.entries(adjacency)) {
      expect(neighborList).not.toContain(code);
    }
  });

  it("has no duplicate neighbors", () => {
    for (const neighborList of Object.values(adjacency)) {
      expect(new Set(neighborList).size).toBe(neighborList.length);
    }
  });

  it("applies every documented border fix in both directions", () => {
    for (const { a, b } of BORDER_FIXES) {
      expect(adjacency[a]).toContain(b);
      expect(adjacency[b]).toContain(a);
    }
  });

  it("finds real, unambiguous land borders correctly", () => {
    expect(adjacency.GB).toContain("IE"); // Northern Ireland
    expect(adjacency.RU).toContain("KP"); // short but real
    expect(adjacency.HR).toContain("ME");
    expect(adjacency.FR).toContain("DE");
    expect(adjacency.US).toContain("CA");
    expect(adjacency.US).toContain("MX");
  });

  it("gives Angola's Cabinda exclave its real neighbours at the country level", () => {
    expect(adjacency.AO).toContain("CD");
    expect(adjacency.AO).toContain("CG");
  });

  it("keeps Western Sahara between Morocco and Mauritania, so they aren't adjacent", () => {
    expect(adjacency.EH).toContain("MA");
    expect(adjacency.EH).toContain("MR");
    expect(adjacency.MA).not.toContain("MR");
  });

  it("deliberately does not connect Spain and Morocco (matches travle's own ruling)", () => {
    expect(adjacency.ES).not.toContain("MA");
  });

  it("deliberately does not connect Sri Lanka and India (reference-data error, no real land route)", () => {
    expect(adjacency.LK).not.toContain("IN");
    expect(adjacency.IN).not.toContain("LK");
  });

  it("gives island nations with no land border zero neighbors", () => {
    expect(adjacency.IS).toEqual([]); // Iceland
    expect(adjacency.NZ).toEqual([]); // New Zealand
    expect(adjacency.JP).toEqual([]); // Japan
  });

  it("every code referenced by a fix exists in the topology", () => {
    const codes = new Set(Object.keys(adjacency));
    for (const { a, b } of BORDER_FIXES) {
      expect(codes.has(a)).toBe(true);
      expect(codes.has(b)).toBe(true);
    }
  });
});
