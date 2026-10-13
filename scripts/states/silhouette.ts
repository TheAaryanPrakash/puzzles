import { geoMercator, geoPath } from "d3-geo";
import type { Feature, Geometry, Position } from "geojson";

export interface Silhouette {
  /** SVG path `d` attribute, fitted to its own `viewBox` independent of every other state. */
  path: string;
  viewBox: string;
}

const SIZE = 320;
const PADDING = 16;
const DECIMALS = 1;

function roundPath(d: string): string {
  return d.replace(/-?\d+\.\d+/g, (m) => Number(m).toFixed(DECIMALS));
}

function ringArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/**
 * The feature's own largest contiguous polygon (by outer-ring area), used only to size the
 * projection — a handful of UTs (Lakshadweep, Puducherry's 4 enclaves, Andaman & Nicobar, the
 * merged Dadra-Nagar-Haveli-Daman-Diu) are MultiPolygons whose parts are scattered across hundreds
 * of km of open sea or other states, so fitting to the *whole* multi-polygon's bounding box (the
 * naive `fitExtent(extent, feature)`) sized the frame around that huge scattered extent and shrank
 * the actual recognizable landmass to under 1% of it (measured: Lakshadweep ~0.01% ink coverage,
 * Puducherry ~0.08%) — technically "fitted," but not visible. A single Polygon feature is returned
 * unchanged.
 */
function largestPart(geometry: Geometry): Geometry {
  if (geometry.type !== "MultiPolygon") return geometry;
  let best = geometry.coordinates[0];
  let bestArea = -1;
  for (const coordinates of geometry.coordinates) {
    const area = ringArea(coordinates[0]);
    if (area > bestArea) {
      bestArea = area;
      best = coordinates;
    }
  }
  return { type: "Polygon", coordinates: best };
}

/**
 * Renders one state/UT's own silhouette, scaled to fill a fixed 320×320 frame regardless of its
 * real-world size — the same choice Worldle makes (Vatican and Russia both render comfortably
 * large), since the game only needs the *shape* to be recognizable. See RESEARCH.md §4. The
 * projection's scale/translate come from the feature's largest part only (see `largestPart`); the
 * full feature (every part, including small exclaves) is still what gets drawn — smaller parts
 * just end up small or near/outside the padded edge, same trade-off Worldle already makes.
 */
export function buildSilhouette(feature: Feature<Geometry>): Silhouette {
  const projection = geoMercator().fitExtent(
    [
      [PADDING, PADDING],
      [SIZE - PADDING, SIZE - PADDING],
    ],
    { type: "Feature", properties: {}, geometry: largestPart(feature.geometry) },
  );
  const d = geoPath(projection)(feature) ?? "";
  return { path: roundPath(d), viewBox: `0 0 ${SIZE} ${SIZE}` };
}
