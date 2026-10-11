// Pure geometry helpers for the Worldle generator. No I/O here — see build-silhouettes.ts.
import { geoArea, geoCentroid } from "d3-geo";
import { distanceKm, type LonLat } from "../../src/lib/geo";

/** Minimal structural subset of GeoJSON we actually touch (avoids a @types/geojson dependency). */
export interface Ring {
  type: "Polygon";
  coordinates: number[][][];
}

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type CountryGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface CountryFeature {
  type: "Feature";
  geometry: CountryGeometry;
  properties: Record<string, unknown>;
}

const EARTH_RADIUS_KM = 6371;

function ringArea(coordinates: number[][][]): number {
  return geoArea({ type: "Polygon", coordinates }) * EARTH_RADIUS_KM * EARTH_RADIUS_KM;
}

function ringCentroid(coordinates: number[][][]): LonLat {
  return geoCentroid({ type: "Polygon", coordinates });
}

/**
 * Natural Earth's admin-0 polygons fold a sovereign state's far-flung overseas pieces into the
 * *same* multipolygon feature as its mainland (France + French Guiana, Chile + Easter Island,
 * South Africa + the Prince Edward Islands, …). Projecting the whole multipolygon with a plain
 * fitSize shrinks the mainland to a sliver next to a distant dot. This keeps only the rings within
 * `maxDistanceKm` of the largest-area ring (the "mainland anchor") — close archipelagos (Indonesia,
 * Japan, the Philippines, the UK + Northern Ireland) stay intact; remote exclaves are dropped.
 * `Polygon` features (already a single ring) pass through unchanged.
 */
export function clusterToMainland(
  feature: CountryFeature,
  maxDistanceKm = 3000,
): CountryFeature {
  if (feature.geometry.type === "Polygon") return feature;

  const parts = feature.geometry.coordinates.map((coordinates) => ({
    coordinates,
    area: ringArea(coordinates),
    centroid: ringCentroid(coordinates),
  }));

  const anchor = parts.reduce((biggest, part) => (part.area > biggest.area ? part : biggest));
  const kept = parts.filter((part) => distanceKm(anchor.centroid, part.centroid) <= maxDistanceKm);

  if (kept.length === parts.length) return feature;

  const geometry: CountryGeometry =
    kept.length === 1
      ? { type: "Polygon", coordinates: kept[0].coordinates }
      : { type: "MultiPolygon", coordinates: kept.map((part) => part.coordinates) };

  return { ...feature, geometry };
}

/** Total area (km²) of a feature, summing every ring (used only for reporting/sorting, not gameplay). */
export function featureAreaKm2(feature: CountryFeature): number {
  if (feature.geometry.type === "Polygon") return ringArea(feature.geometry.coordinates);
  return feature.geometry.coordinates.reduce((sum, coordinates) => sum + ringArea(coordinates), 0);
}

/** Geographic centroid ([lon, lat]) of a feature's geometry, for distance/bearing scoring. */
export function featureCentroid(feature: CountryFeature): LonLat {
  return geoCentroid(feature.geometry);
}
