import { describe, it, expect } from "vitest";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { buildSilhouette } from "./silhouette";

// Ring winding follows GeoJSON's spherical right-hand rule (interior to the left while walking the
// ring, viewed from outside the sphere) — the opposite of what a flat lon/lat shoelace sum would
// suggest, which is a well-known d3-geo gotcha. Verified empirically: this order (not the mirrored
// one) renders as a filled square, not an inverted "everywhere except this square" hole. Every
// fixture below follows the same up/right/down/close order.
const SQUARE: Feature<Polygon> = {
  type: "Feature",
  properties: { code: "X1", name: "Square" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [70, 20],
        [70, 21],
        [71, 21],
        [71, 20],
        [70, 20],
      ],
    ],
  },
};

const TWO_ISLANDS: Feature<MultiPolygon> = {
  type: "Feature",
  properties: { code: "X2", name: "Islands" },
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [70, 20],
          [70, 20.2],
          [70.2, 20.2],
          [70.2, 20],
          [70, 20],
        ],
      ],
      [
        [
          [90, 10],
          [90, 10.2],
          [90.2, 10.2],
          [90.2, 10],
          [90, 10],
        ],
      ],
    ],
  },
};

function numbersIn(path: string): number[] {
  return (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

describe("buildSilhouette", () => {
  it("always returns the same fixed viewBox", () => {
    expect(buildSilhouette(SQUARE).viewBox).toBe("0 0 320 320");
    expect(buildSilhouette(TWO_ISLANDS).viewBox).toBe("0 0 320 320");
  });

  it("fits every coordinate within the padded frame", () => {
    const { path } = buildSilhouette(SQUARE);
    const nums = numbersIn(path);
    expect(nums.length).toBeGreaterThan(0);
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(16 - 0.5);
      expect(n).toBeLessThanOrEqual(304 + 0.5);
    }
  });

  it("renders every disjoint part of a multi-polygon (no gaps dropped)", () => {
    const { path } = buildSilhouette(TWO_ISLANDS);
    // Two separate subpaths means two "M" (moveto) commands.
    expect(path.match(/M/g)?.length).toBe(2);
  });

  it("rounds coordinates to at most 1 decimal place", () => {
    const { path } = buildSilhouette(SQUARE);
    for (const n of numbersIn(path)) {
      expect(Number(n.toFixed(1))).toBeCloseTo(n, 10);
    }
  });

  it("scales a tiny shape as large as a bigger one (independent per-feature fit)", () => {
    const tiny: Feature<Polygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [70, 20],
            [70, 20.01],
            [70.01, 20.01],
            [70.01, 20],
            [70, 20],
          ],
        ],
      },
    };
    const big: Feature<Polygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [60, 10],
            [60, 30],
            [90, 30],
            [90, 10],
            [60, 10],
          ],
        ],
      },
    };
    const span = (path: string) => {
      const nums = numbersIn(path);
      return Math.max(...nums) - Math.min(...nums);
    };
    const tinySpan = span(buildSilhouette(tiny).path);
    const bigSpan = span(buildSilhouette(big).path);
    // Both independently fit to ~the same 288-unit frame, regardless of true size difference.
    expect(Math.abs(tinySpan - bigSpan)).toBeLessThan(5);
  });
});
