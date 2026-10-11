import { useEffect, useState } from "react";
import type { CountryNames, CountryCentroids } from "./logic";

export interface SilhouetteEntry {
  d: string;
  viewBox: string;
  centroid: [number, number];
}

type Silhouettes = Record<string, SilhouetteEntry>;

export interface CountryData {
  names: CountryNames;
  centroids: CountryCentroids;
  silhouettes: Silhouettes;
  codes: string[];
}

export type CountryDataStatus = "loading" | "ready" | "error";

/**
 * Loads the two static, non-secret assets every guess and render need: the precomputed
 * silhouettes (`public/assets/worldle/silhouettes.json`, built by `scripts/worldle/`) and the
 * shared country name/alias lookup (`public/assets/shared/country-names.json`). Fetched once per
 * mount; both are small (a few hundred KB) and cached by the browser across days.
 */
export function useCountryData(): { data: CountryData | null; status: CountryDataStatus } {
  const [data, setData] = useState<CountryData | null>(null);
  const [status, setStatus] = useState<CountryDataStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    void (async () => {
      try {
        const [silhouettesRes, namesRes] = await Promise.all([
          fetch("/assets/worldle/silhouettes.json"),
          fetch("/assets/shared/country-names.json"),
        ]);
        if (!silhouettesRes.ok || !namesRes.ok) throw new Error("worldle: failed to load country data");
        const silhouettes = (await silhouettesRes.json()) as Silhouettes;
        const names = (await namesRes.json()) as CountryNames;
        if (cancelled) return;

        // Only codes with a precomputed silhouette are guessable — this is the same pool the
        // generator draws answers from (very small/non-sovereign territories already excluded),
        // so a guess can never be something the game could never have asked about.
        const codes = Object.keys(silhouettes).sort();
        const centroids: CountryCentroids = {};
        const playableNames: CountryNames = {};
        for (const code of codes) {
          centroids[code] = silhouettes[code].centroid;
          if (names[code]) playableNames[code] = names[code];
        }

        setData({ names: playableNames, centroids, silhouettes, codes });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, status };
}
