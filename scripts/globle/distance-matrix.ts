// Precomputes a border-to-border distance matrix for every country in the shared world topology.
// Pure functions here are unit tested (distance-matrix.test.ts); `main()` at the bottom does the
// I/O and is only invoked when this file is run directly (`npx tsx scripts/globle/distance-matrix.ts`).
import { neighbors as topojsonNeighbors, feature as topojsonFeature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { geoDistance } from "d3-geo";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const EARTH_RADIUS_KM = 6371;
const RING_MAX_POINTS = 25;

export type LonLat = [number, number];

/** Evenly-strided sample of a ring (closing point dropped), capped at `maxPoints`. */
export function decimateRing(ring: readonly LonLat[], maxPoints: number): LonLat[] {
  const pts = ring.slice(0, -1); // first/last point of a closed ring are identical
  if (pts.length <= maxPoints) return pts;
  const stride = pts.length / maxPoints;
  const out: LonLat[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(pts[Math.floor(i * stride)]);
  return out;
}

/** Every ring of a Polygon/MultiPolygon geometry, decimated. */
export function decimatedPoints(
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown },
  maxPoints: number,
): LonLat[] {
  const polys =
    geometry.type === "Polygon"
      ? [geometry.coordinates as LonLat[][]]
      : (geometry.coordinates as LonLat[][][]);
  const points: LonLat[] = [];
  for (const poly of polys) for (const ring of poly) points.push(...decimateRing(ring, maxPoints));
  return points;
}

/** Minimum great-circle distance (km) between any point of `a` and any point of `b`. */
export function minDistanceKm(a: readonly LonLat[], b: readonly LonLat[]): number {
  let min = Infinity;
  for (const pa of a) {
    for (const pb of b) {
      const km = geoDistance(pa, pb) * EARTH_RADIUS_KM;
      if (km < min) {
        min = km;
        if (min < 1) return min; // already touching for practical purposes
      }
    }
  }
  return min;
}

export interface DistanceMatrix {
  codes: string[];
  /** km[i][j] — symmetric, diagonal 0, neighbours 0. Rounded to the nearest km. */
  km: number[][];
}

/**
 * Builds the full matrix: neighbours (shared TopoJSON arcs — exact, no decimation involved) are
 * 0 km; every other pair is the decimated min vertex-to-vertex great-circle distance.
 */
export function buildDistanceMatrix(
  topology: Topology,
  objectName: string,
  ringMaxPoints = RING_MAX_POINTS,
): DistanceMatrix {
  const collection = topology.objects[objectName] as GeometryCollection;
  const geometries = collection.geometries;
  const codes = geometries.map((g) => (g.properties as { iso_a2: string }).iso_a2);
  const n = geometries.length;

  const neighborSets: Set<number>[] = topojsonNeighbors(geometries).map((row) => new Set(row));

  const featureCollection = topojsonFeature(topology, collection);
  const points = featureCollection.features.map((f) =>
    decimatedPoints(f.geometry as { type: "Polygon" | "MultiPolygon"; coordinates: unknown }, ringMaxPoints),
  );

  const km: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = neighborSets[i].has(j) ? 0 : Math.round(minDistanceKm(points[i], points[j]));
      km[i][j] = d;
      km[j][i] = d;
    }
  }

  return { codes, km };
}

function isMain(): boolean {
  return process.argv[1] === new URL(import.meta.url).pathname;
}

async function main() {
  const root = resolve(import.meta.dirname, "../..");
  const topologyPath = resolve(root, "public/assets/shared/countries.json");
  const outPath = resolve(root, "public/assets/globle/distances.json");

  const topology = JSON.parse(await readFile(topologyPath, "utf8")) as Topology;
  const countryCount = (topology.objects.countries as GeometryCollection).geometries.length;
  console.log(`Computing border-to-border distances for ${countryCount} countries…`);

  const t0 = Date.now();
  const matrix = buildDistanceMatrix(topology, "countries");
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);

  await writeFile(outPath, JSON.stringify(matrix));
  console.log(`Wrote ${outPath} (${matrix.codes.length} codes, ${seconds}s)`);
}

if (isMain()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
