import { describe, it, expect } from "vitest";
import { clusterToMainland, featureAreaKm2, featureCentroid, type CountryFeature } from "./geometry";

// Counter-clockwise exterior ring (right-hand rule, as GeoJSON/d3-geo expect).
function square(lon: number, lat: number, size: number): number[][] {
  return [
    [lon, lat],
    [lon, lat + size],
    [lon + size, lat + size],
    [lon + size, lat],
    [lon, lat],
  ];
}

function feature(parts: number[][][]): CountryFeature {
  return parts.length === 1
    ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [parts[0]] } }
    : {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiPolygon", coordinates: parts.map((ring) => [ring]) },
      };
}

describe("clusterToMainland", () => {
  it("leaves a single-ring Polygon untouched", () => {
    const f = feature([square(0, 0, 2)]);
    expect(clusterToMainland(f)).toBe(f);
  });

  it("keeps a nearby ring (a close archipelago) attached to the mainland anchor", () => {
    // mainland centroid ~ (1,1); second ring centroid ~ (6,6) — a few hundred km away.
    const f = feature([square(0, 0, 2), square(5, 5, 2)]);
    const result = clusterToMainland(f, 3000);
    expect(result.geometry.type).toBe("MultiPolygon");
    expect((result.geometry as { coordinates: unknown[] }).coordinates).toHaveLength(2);
  });

  it("drops a ring far from the mainland anchor (a remote overseas exclave)", () => {
    // mainland centroid ~ (1,1); far ring centroid ~ (61,1) — ~6,600 km away along the equator.
    const f = feature([square(0, 0, 2), square(60, 0, 2)]);
    const result = clusterToMainland(f, 3000);
    expect(result.geometry.type).toBe("Polygon");
    expect((result.geometry as { coordinates: unknown[] }).coordinates).toHaveLength(1);
  });

  it("keeps the larger ring as the anchor regardless of array order", () => {
    // small far ring listed first, big mainland ring second — anchor must still be the big one.
    const f = feature([square(60, 0, 1), square(0, 0, 5)]);
    const result = clusterToMainland(f, 3000);
    // only the big ring (now alone) should survive — far small ring dropped.
    expect(result.geometry.type).toBe("Polygon");
  });

  it("returns the original feature when every ring is within range", () => {
    const f = feature([square(0, 0, 2), square(1, 1, 1)]);
    const result = clusterToMainland(f, 3000);
    expect(result).toBe(f);
  });
});

describe("featureAreaKm2", () => {
  it("sums area across every ring of a MultiPolygon", () => {
    const multi = feature([square(0, 0, 2), square(5, 5, 2)]);
    const single = feature([square(0, 0, 2)]);
    expect(featureAreaKm2(multi)).toBeGreaterThan(featureAreaKm2(single));
  });
});

describe("featureCentroid", () => {
  it("returns a [lon, lat] pair inside the overall bounds", () => {
    const f = feature([square(0, 0, 2)]);
    const [lon, lat] = featureCentroid(f);
    expect(lon).toBeGreaterThanOrEqual(0);
    expect(lon).toBeLessThanOrEqual(2);
    expect(lat).toBeGreaterThanOrEqual(0);
    expect(lat).toBeLessThanOrEqual(2);
  });
});
