// Loads the shared world topology + country names, and this game's precomputed distance matrix,
// from public/ (never bundled — see vite.config.ts's content-server comment for why puzzle-style
// assets are fetched, not imported). Cached as a single module-level promise so every component
// that needs it shares one fetch, however many times `useWorldData` is mounted.
import { useEffect, useState } from "react";
import { feature as topojsonFeature } from "topojson-client";

export interface CountryProperties {
  iso_a2: string;
  name: string;
}

// `topojson-client`'s own .d.ts pulls in the `geojson`/`topojson-specification` ambient packages,
// which pnpm nests inside @types/topojson-client's own node_modules rather than hoisting to the
// project root (neither is a direct dependency, and package.json is frozen — see CLAUDE.md). The
// minimal local shapes below are what this game actually reads off a feature; `Parameters<>` /
// `ReturnType<>` on `topojsonFeature` itself (below) sidestep importing those package names.
export interface CountryFeature {
  type: "Feature";
  properties: CountryProperties;
  geometry: { type: string; coordinates: unknown };
}

export interface CountryFeatureCollection {
  type: "FeatureCollection";
  features: CountryFeature[];
}

export interface CountryNameEntry {
  name: string;
  aliases: string[];
}

interface DistanceMatrix {
  codes: string[];
  km: number[][];
}

interface RawTopology {
  type: "Topology";
  objects: Record<string, { type: string; geometries: { properties: CountryProperties }[] }>;
  arcs: unknown;
}

export interface WorldData {
  countries: CountryFeatureCollection;
  names: Record<string, CountryNameEntry>;
  /** Border-to-border km between any two country codes; 0 for land neighbours. */
  distanceKm: (a: string, b: string) => number;
  /** Every code present in both the topology and the distance matrix, for the autocomplete. */
  codes: string[];
}

let cached: Promise<WorldData> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

type TopojsonFeatureTopologyArg = Parameters<typeof topojsonFeature>[0];
type TopojsonFeatureObjectArg = Parameters<typeof topojsonFeature>[1];

function loadWorldData(): Promise<WorldData> {
  if (!cached) {
    cached = (async () => {
      const [topology, names, matrix] = await Promise.all([
        fetchJson<RawTopology>("/assets/shared/countries.json"),
        fetchJson<Record<string, CountryNameEntry>>("/assets/shared/country-names.json"),
        fetchJson<DistanceMatrix>("/assets/globle/distances.json"),
      ]);
      const countries = topojsonFeature(
        topology as unknown as TopojsonFeatureTopologyArg,
        topology.objects.countries as unknown as TopojsonFeatureObjectArg,
      ) as unknown as CountryFeatureCollection;

      const indexOf = new Map(matrix.codes.map((code, i) => [code, i]));
      const distanceKm = (a: string, b: string): number => {
        const i = indexOf.get(a);
        const j = indexOf.get(b);
        if (i === undefined || j === undefined) return NaN;
        return matrix.km[i][j];
      };

      return { countries, names, distanceKm, codes: matrix.codes };
    })();
  }
  return cached;
}

export type WorldDataStatus = "loading" | "ready" | "error";

export function useWorldData(): { status: WorldDataStatus; data: WorldData | null } {
  const [state, setState] = useState<{ status: WorldDataStatus; data: WorldData | null }>({
    status: "loading",
    data: null,
  });

  useEffect(() => {
    let cancelled = false;
    void loadWorldData()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
