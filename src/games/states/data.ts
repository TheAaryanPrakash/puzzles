import { useEffect, useState } from "react";
import type { StatesIndex } from "./logic";

export interface SilhouetteInfo {
  path: string;
  viewBox: string;
}

export interface StatesData {
  maxDistanceKm: number;
  states: StatesIndex;
  silhouettes: Record<string, SilhouetteInfo>;
  /** All codes, sorted by display name — the autocomplete's option order. */
  codes: string[];
}

interface RawSilhouettesFile {
  maxDistanceKm: number;
  states: Record<string, { name: string; path: string; viewBox: string; centroid: [number, number] }>;
}

/** Pure parsing, split out from the fetch so it's unit-testable without a network/DOM. */
export function parseStatesFile(raw: RawSilhouettesFile): StatesData {
  const states: StatesIndex = {};
  const silhouettes: Record<string, SilhouetteInfo> = {};
  for (const [code, info] of Object.entries(raw.states)) {
    states[code] = { name: info.name, centroid: info.centroid };
    silhouettes[code] = { path: info.path, viewBox: info.viewBox };
  }
  const codes = Object.keys(states).sort((a, b) => states[a].name.localeCompare(states[b].name));
  return { maxDistanceKm: raw.maxDistanceKm, states, silhouettes, codes };
}

export type StatesDataStatus = "loading" | "ready" | "error";

/** Fetches `public/assets/states/silhouettes.json` once — every state/UT's silhouette, name and
 *  centroid, plus India's own max centroid distance (see RESEARCH.md §4). */
export function useStatesData(): { data: StatesData | null; status: StatesDataStatus } {
  const [result, setResult] = useState<{ data: StatesData | null; status: StatesDataStatus }>({
    data: null,
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    void fetch("/assets/states/silhouettes.json")
      .then((res) => {
        if (!res.ok) throw new Error(`states data request failed: ${res.status}`);
        return res.json() as Promise<RawSilhouettesFile>;
      })
      .then((raw) => {
        if (!cancelled) setResult({ data: parseStatesFile(raw), status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setResult({ data: null, status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
