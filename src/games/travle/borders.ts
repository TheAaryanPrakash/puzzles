import { neighbors } from "topojson-client";

/** The shape we need from public/assets/shared/countries.json — see scripts/_data/build_countries.py. */
export interface CountryTopology {
  objects: {
    countries: {
      geometries: { properties: { iso_a2: string } }[];
    };
  };
}

export interface BorderFix {
  a: string;
  b: string;
  /** Why this pair is connected despite not sharing a rendered polygon edge at 50m resolution. */
  reason: string;
}

/**
 * Land-border connections real-world travel allows that a pure polygon-adjacency graph can't see,
 * either because a bridge/tunnel/causeway bypasses the water between two countries, or because the
 * border is real but too thin to survive simplification in world-atlas's 50m topojson. Found by
 * diffing `buildAdjacencyFromTopology`'s raw output against mledoze/countries' (MIT) `borders` field
 * — see RESEARCH.md "Border-adjacency data quality" for the full method and the pairs deliberately
 * *not* added (ES–MA, LK–IN).
 */
export const BORDER_FIXES: BorderFix[] = [
  { a: "FR", b: "GB", reason: "Channel Tunnel" },
  { a: "DK", b: "SE", reason: "Øresund Bridge + Drogden Tunnel" },
  { a: "GL", b: "CA", reason: "2022 Canada–Denmark Hans Island border agreement" },
  { a: "MY", b: "SG", reason: "Johor–Singapore Causeway" },
  { a: "BH", b: "SA", reason: "King Fahd Causeway" },
  { a: "BW", b: "ZM", reason: "Kazungula Bridge over the Zambezi quadripoint" },
  { a: "DJ", b: "SO", reason: "real Gulf of Aden land border, lost to 50m simplification" },
];

/**
 * Builds the land-border adjacency graph: topojson-client's `neighbors()` over the shared countries
 * topology (shared-arc adjacency), re-keyed from geometry index to `iso_a2`, plus BORDER_FIXES.
 * Pure and framework-agnostic — callers fetch (browser) or read (Node generator) the topology file
 * themselves; see borders.test.ts and scripts/travle/generate.ts for the two call sites.
 */
export function buildAdjacencyFromTopology(topology: CountryTopology): Record<string, string[]> {
  const geometries = topology.objects.countries.geometries;
  const codes = geometries.map((g) => g.properties.iso_a2);
  const neighborIndexes = neighbors(geometries);

  const adjacency: Record<string, Set<string>> = {};
  for (const code of codes) adjacency[code] = new Set();

  for (let i = 0; i < codes.length; i++) {
    for (const j of neighborIndexes[i]) {
      adjacency[codes[i]].add(codes[j]);
      adjacency[codes[j]].add(codes[i]);
    }
  }

  for (const { a, b } of BORDER_FIXES) {
    adjacency[a]?.add(b);
    adjacency[b]?.add(a);
  }

  const result: Record<string, string[]> = {};
  for (const code of codes) result[code] = [...adjacency[code]].sort();
  return result;
}
