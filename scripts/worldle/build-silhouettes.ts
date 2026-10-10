// Precomputes public/assets/worldle/silhouettes.json — run with `npx tsx scripts/worldle/build-silhouettes.ts`.
// Idempotent: re-running reproduces byte-identical output (no randomness involved at all).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { feature } from "topojson-client";
import { geoPath, geoAzimuthalEqualArea } from "d3-geo";
import { clusterToMainland, featureCentroid, type CountryFeature } from "./geometry";
import { EXCLUDED_CODES } from "./excluded";

/** Minimal shape of the TopoJSON this script reads — avoids a topojson-specification dependency. */
interface Topology {
  type: "Topology";
  objects: { countries: unknown; land: unknown };
  arcs: number[][][];
}

const ROOT = resolve(import.meta.dirname, "../..");
const COUNTRIES_PATH = resolve(ROOT, "public/assets/shared/countries.json");
const OUT_PATH = resolve(ROOT, "public/assets/worldle/silhouettes.json");

const VIEW_SIZE = 320;
const PADDING = 18;
const MAINLAND_CLUSTER_KM = 3000;

export interface SilhouetteEntry {
  /** SVG <path> "d" attribute, already projected and fit to `viewBox`. */
  d: string;
  viewBox: string;
  /** [lon, lat] of the (mainland-clustered) country, used for distance/bearing scoring. */
  centroid: [number, number];
}

export function buildSilhouettes(topo: Topology): Record<string, SilhouetteEntry> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(topo as any, topo.objects.countries as any) as unknown as {
    features: CountryFeature[];
  };

  const out: Record<string, SilhouetteEntry> = {};
  for (const raw of fc.features) {
    const code = String(raw.properties.iso_a2 ?? "");
    if (!code || EXCLUDED_CODES.has(code)) continue;

    const mainland = clusterToMainland(raw, MAINLAND_CLUSTER_KM);
    const centroid = featureCentroid(mainland);

    const projection = geoAzimuthalEqualArea()
      .rotate([-centroid[0], -centroid[1]])
      .fitExtent(
        [
          [PADDING, PADDING],
          [VIEW_SIZE - PADDING, VIEW_SIZE - PADDING],
        ],
        mainland,
      );
    const d = geoPath(projection)(mainland);
    if (!d) throw new Error(`worldle: empty silhouette path for ${code}`);

    out[code] = { d, viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`, centroid };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const topo = JSON.parse(readFileSync(COUNTRIES_PATH, "utf8")) as Topology;
  const silhouettes = buildSilhouettes(topo);

  mkdirSync(resolve(ROOT, "public/assets/worldle"), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(silhouettes));

  console.log(`worldle: wrote ${Object.keys(silhouettes).length} silhouettes to ${OUT_PATH}`);
}
