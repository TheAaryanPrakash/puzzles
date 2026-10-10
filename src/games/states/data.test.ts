import { describe, it, expect } from "vitest";
import { parseStatesFile } from "./data";

describe("parseStatesFile", () => {
  const raw = {
    maxDistanceKm: 3105,
    states: {
      "IN-KA": { name: "Karnataka", path: "M0,0Z", viewBox: "0 0 320 320", centroid: [75.7, 15.3] as [number, number] },
      "IN-OD": { name: "Odisha", path: "M1,1Z", viewBox: "0 0 320 320", centroid: [84.2, 20.5] as [number, number] },
    },
  };

  it("splits the raw file into a geo index and a silhouette table", () => {
    const data = parseStatesFile(raw);
    expect(data.maxDistanceKm).toBe(3105);
    expect(data.states["IN-KA"]).toEqual({ name: "Karnataka", centroid: [75.7, 15.3] });
    expect(data.silhouettes["IN-KA"]).toEqual({ path: "M0,0Z", viewBox: "0 0 320 320" });
  });

  it("sorts codes by display name", () => {
    const data = parseStatesFile(raw);
    expect(data.codes).toEqual(["IN-KA", "IN-OD"]);
  });
});
