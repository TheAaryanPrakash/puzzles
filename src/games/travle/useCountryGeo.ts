import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { buildAdjacencyFromTopology, type CountryTopology } from "./borders";

export interface CountryFeatureProperties {
  name: string;
  iso_a2: string;
}

export type CountryFeature = Feature<Geometry, CountryFeatureProperties>;

export interface CountryNames {
  [code: string]: { name: string; aliases: string[] };
}

export interface CountryGeo {
  adjacency: Record<string, string[]>;
  features: CountryFeature[];
  names: CountryNames;
  loading: boolean;
}

// Module-level caches: these shared files never change at runtime, so every Map/game instance
// across the whole session fetches each one at most once.
let topologyPromise: Promise<Topology> | null = null;
function loadTopology(): Promise<Topology> {
  topologyPromise ??= fetch("/assets/shared/countries.json").then(
    (res) => res.json() as Promise<Topology>,
  );
  return topologyPromise;
}

let namesPromise: Promise<CountryNames> | null = null;
function loadNames(): Promise<CountryNames> {
  namesPromise ??= fetch("/assets/shared/country-names.json").then(
    (res) => res.json() as Promise<CountryNames>,
  );
  return namesPromise;
}

/** Fetches the shared world topology and country names once, then derives both the border graph
 *  and plain GeoJSON features for rendering — everything travle needs from the shared geo data. */
export function useCountryGeo(): CountryGeo {
  const [geo, setGeo] = useState<Omit<CountryGeo, "loading">>({
    adjacency: {},
    features: [],
    names: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadTopology(), loadNames()]).then(([topology, names]) => {
      if (cancelled) return;
      const adjacency = buildAdjacencyFromTopology(topology as unknown as CountryTopology);
      const collection = feature(topology, "countries") as FeatureCollection<
        Geometry,
        CountryFeatureProperties
      >;
      setGeo({ adjacency, features: collection.features, names });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...geo, loading };
}
