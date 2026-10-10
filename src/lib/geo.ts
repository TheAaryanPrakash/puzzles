import { geoCentroid, geoDistance } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";

const EARTH_RADIUS_KM = 6371;
const ANTIPODAL_KM = Math.PI * EARTH_RADIUS_KM; // ~20,015 km — the farthest two points on Earth can be

export type LonLat = [lon: number, lat: number];

/** Geographic centroid of a GeoJSON geometry/feature, as [lon, lat]. */
export function centroid(geometry: GeoPermissibleObjects): LonLat {
  return geoCentroid(geometry);
}

/** Great-circle distance between two [lon, lat] points, in kilometres. */
export function distanceKm(a: LonLat, b: LonLat): number {
  return geoDistance(a, b) * EARTH_RADIUS_KM;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Initial compass bearing from `from` to `to`, in degrees [0, 360). */
export function bearing(from: LonLat, to: LonLat): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

const ARROWS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];

/** Maps a bearing in degrees to one of 8 compass arrow glyphs (for spoiler-free share text). */
export function bearingArrow(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return ARROWS[Math.round(normalized / 45) % 8];
}

/**
 * A 0–100 "how close" score for a guess, 100 being exact and 0 being as far as two points on
 * Earth can be (the antipodal distance). `maxDistanceKm` can be overridden for a smaller map.
 */
export function proximityPct(distanceKmValue: number, maxDistanceKm = ANTIPODAL_KM): number {
  const pct = 100 - (distanceKmValue / maxDistanceKm) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
