import { describe, expect, it } from "vitest";
import type { Topology } from "topojson-specification";
import {
  buildDistanceMatrix,
  decimateRing,
  decimatedPoints,
  minDistanceKm,
  type LonLat,
} from "./distance-matrix";

describe("decimateRing", () => {
  it("returns a ring unchanged when it's already short enough", () => {
    const ring: LonLat[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    expect(decimateRing(ring, 10)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it("caps a long ring at maxPoints, always dropping the duplicated closing point", () => {
    const ring: LonLat[] = Array.from({ length: 101 }, (_, i) => [i, 0]);
    ring.push(ring[0]);
    const out = decimateRing(ring, 20);
    expect(out.length).toBe(20);
  });
});

describe("decimatedPoints", () => {
  it("flattens every ring of a MultiPolygon", () => {
    const geometry = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
        [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 10],
          ],
        ],
      ],
    };
    expect(decimatedPoints(geometry, 10)).toHaveLength(6);
  });
});

describe("minDistanceKm", () => {
  it("is ~0 for coincident points", () => {
    expect(minDistanceKm([[0, 0]], [[0, 0]])).toBeLessThan(0.001);
  });

  it("finds the minimum over every pair, not the first/last", () => {
    const a: LonLat[] = [
      [0, 0],
      [50, 50],
    ];
    const b: LonLat[] = [
      [0.01, 0.01],
      [60, 60],
    ];
    // a[0]-b[0] (near 0,0) should win over the far pairs.
    expect(minDistanceKm(a, b)).toBeLessThan(5);
  });
});

/** A minimal two-country TopoJSON topology: adjacent unit squares sharing arc 0. */
function twoAdjacentSquares(): Topology {
  return {
    type: "Topology",
    arcs: [
      // shared border, arc 0: (1,0) -> (1,1)
      [
        [1, 0],
        [1, 1],
      ],
      // country A's remaining boundary, closing the square (1,1)->(0,1)->(0,0)->(1,0)
      [
        [1, 1],
        [0, 1],
        [0, 0],
        [1, 0],
      ],
      // country B's remaining boundary: (1,0)->(2,0)->(2,1)->(1,1)
      [
        [1, 0],
        [2, 0],
        [2, 1],
        [1, 1],
      ],
    ],
    objects: {
      countries: {
        type: "GeometryCollection",
        geometries: [
          { type: "Polygon", arcs: [[0, 1]], properties: { iso_a2: "AA" } },
          { type: "Polygon", arcs: [[~0, 2]], properties: { iso_a2: "BB" } },
        ],
      },
    },
  } as unknown as Topology;
}

/** A far-apart third country, antipodal-ish from AA/BB, sharing no arcs. */
function threeCountriesOneFar(): Topology {
  const base = twoAdjacentSquares();
  return {
    ...base,
    arcs: [
      ...base.arcs,
      [
        [100, 80],
        [101, 80],
        [101, 81],
        [100, 80],
      ],
    ],
    objects: {
      countries: {
        type: "GeometryCollection",
        geometries: [
          ...(base.objects.countries as { geometries: unknown[] }).geometries,
          { type: "Polygon", arcs: [[3]], properties: { iso_a2: "CC" } },
        ],
      },
    },
  } as unknown as Topology;
}

describe("buildDistanceMatrix", () => {
  it("gives adjacent countries 0 km regardless of geometry", () => {
    const matrix = buildDistanceMatrix(twoAdjacentSquares(), "countries");
    expect(matrix.codes).toEqual(["AA", "BB"]);
    expect(matrix.km[0][1]).toBe(0);
    expect(matrix.km[1][0]).toBe(0);
  });

  it("is symmetric with a zero diagonal", () => {
    const matrix = buildDistanceMatrix(threeCountriesOneFar(), "countries");
    for (let i = 0; i < matrix.codes.length; i++) {
      expect(matrix.km[i][i]).toBe(0);
      for (let j = 0; j < matrix.codes.length; j++) {
        expect(matrix.km[i][j]).toBe(matrix.km[j][i]);
      }
    }
  });

  it("gives a non-neighbour pair a positive, non-zero distance", () => {
    const matrix = buildDistanceMatrix(threeCountriesOneFar(), "countries");
    const cc = matrix.codes.indexOf("CC");
    const aa = matrix.codes.indexOf("AA");
    expect(matrix.km[cc][aa]).toBeGreaterThan(1000);
  });
});
