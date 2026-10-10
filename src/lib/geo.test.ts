import { describe, it, expect } from "vitest";
import { distanceKm, bearing, bearingArrow, proximityPct } from "./geo";
import type { LonLat } from "./geo";

const LONDON: LonLat = [-0.1278, 51.5074];
const PARIS: LonLat = [2.3522, 48.8566];
const NEW_YORK: LonLat = [-74.006, 40.7128];
const LOS_ANGELES: LonLat = [-118.2437, 34.0522];

describe("distanceKm", () => {
  it("London to Paris is about 344 km", () => {
    expect(distanceKm(LONDON, PARIS)).toBeGreaterThan(330);
    expect(distanceKm(LONDON, PARIS)).toBeLessThan(360);
  });

  it("New York to Los Angeles is about 3936 km", () => {
    expect(distanceKm(NEW_YORK, LOS_ANGELES)).toBeGreaterThan(3850);
    expect(distanceKm(NEW_YORK, LOS_ANGELES)).toBeLessThan(4020);
  });

  it("a point to itself is 0", () => {
    expect(distanceKm(LONDON, LONDON)).toBeCloseTo(0, 3);
  });

  it("is symmetric", () => {
    expect(distanceKm(LONDON, PARIS)).toBeCloseTo(distanceKm(PARIS, LONDON), 6);
  });
});

describe("bearing", () => {
  it("New York to London is roughly north-east (~51°)", () => {
    const b = bearing(NEW_YORK, LONDON);
    expect(b).toBeGreaterThan(45);
    expect(b).toBeLessThan(58);
  });

  it("is always in [0, 360)", () => {
    expect(bearing(LONDON, NEW_YORK)).toBeGreaterThanOrEqual(0);
    expect(bearing(LONDON, NEW_YORK)).toBeLessThan(360);
  });
});

describe("bearingArrow", () => {
  it.each([
    [0, "⬆️"],
    [90, "➡️"],
    [180, "⬇️"],
    [270, "⬅️"],
    [360, "⬆️"],
    [-90, "⬅️"],
  ])("maps %i° to %s", (deg, arrow) => {
    expect(bearingArrow(deg)).toBe(arrow);
  });
});

describe("proximityPct", () => {
  it("is 100 at distance 0", () => {
    expect(proximityPct(0)).toBe(100);
  });

  it("is 0 at or beyond the antipodal distance", () => {
    expect(proximityPct(20015)).toBeLessThanOrEqual(1);
    expect(proximityPct(50000)).toBe(0);
  });

  it("decreases monotonically with distance", () => {
    expect(proximityPct(1000)).toBeGreaterThan(proximityPct(5000));
  });

  it("respects a custom max distance", () => {
    expect(proximityPct(50, 100)).toBe(50);
  });
});
