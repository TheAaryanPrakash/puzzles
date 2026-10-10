import { geoMercator, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";

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

/**
 * Renders one state/UT's own silhouette, scaled to fill a fixed 320×320 frame regardless of its
 * real-world size — the same choice Worldle makes (Vatican and Russia both render comfortably
 * large), since the game only needs the *shape* to be recognizable. See RESEARCH.md §4.
 */
export function buildSilhouette(feature: Feature<Geometry>): Silhouette {
  const projection = geoMercator().fitExtent(
    [
      [PADDING, PADDING],
      [SIZE - PADDING, SIZE - PADDING],
    ],
    feature,
  );
  const d = geoPath(projection)(feature) ?? "";
  return { path: roundPath(d), viewBox: `0 0 ${SIZE} ${SIZE}` };
}
