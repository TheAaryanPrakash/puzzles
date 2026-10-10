import { useEffect, useState } from "react";
import type { LonLat } from "../../lib/geo";

export interface CountryOption {
  code: string;
  name: string;
  aliases: string[];
}

interface NamesFile {
  [code: string]: { name: string; aliases: string[] };
}
type CentroidsFile = Record<string, LonLat>;

interface FlagleAssets {
  /** Every guessable country (has a centroid, i.e. is actually in the puzzle pool), name-sorted. */
  options: CountryOption[];
  /** code -> [lon, lat], for `logic.ts`'s `feedbackFor`. */
  centroids: CentroidsFile;
}

let cache: Promise<FlagleAssets> | null = null;

/**
 * `public/assets/shared/country-names.json` (names + aliases, shared with every geo game) and
 * `public/assets/flagle/centroids.json` (this game's own precomputed centroids — see RESEARCH.md
 * for why those are generated ahead of time rather than parsed from the full map topology at
 * runtime), fetched once per page load and cached across every component that needs them.
 */
async function loadFlagleAssets(): Promise<FlagleAssets> {
  cache ??= (async () => {
    const [namesRes, centroidsRes] = await Promise.all([
      fetch("/assets/shared/country-names.json"),
      fetch("/assets/flagle/centroids.json"),
    ]);
    const names = (await namesRes.json()) as NamesFile;
    const centroids = (await centroidsRes.json()) as CentroidsFile;
    const options = Object.keys(centroids)
      .filter((code) => names[code])
      .map((code) => ({ code, name: names[code].name, aliases: names[code].aliases }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { options, centroids };
  })();
  return cache;
}

export function useFlagleAssets(): FlagleAssets & { loading: boolean } {
  const [assets, setAssets] = useState<FlagleAssets>({ options: [], centroids: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadFlagleAssets().then((loaded) => {
      if (!cancelled) {
        setAssets(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...assets, loading };
}
