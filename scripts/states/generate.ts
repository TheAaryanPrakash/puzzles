// Generates public/assets/states/silhouettes.json (every state/UT's silhouette, name and centroid,
// plus India's own max centroid-to-centroid distance for scaling proximity%) and
// content/puzzles/states/<date>.json for LAUNCH_DATE … LAUNCH_DATE + SCHEDULE_DAYS - 1.
// Run with: npx tsx scripts/states/generate.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, dayIndex, mulberry32 } from "../../src/lib/daily";
import { centroid, distanceKm, type LonLat } from "../../src/lib/geo";
import { buildSilhouette } from "./silhouette";
import { buildScheduleCodes } from "./pool";

const SEED = 101;
const ROOT = resolve(import.meta.dirname, "../..");
const SHARED_TOPOLOGY = resolve(ROOT, "public/assets/shared/india-states.json");
const SILHOUETTES_OUT = resolve(ROOT, "public/assets/states/silhouettes.json");
const CONTENT_DIR = resolve(ROOT, "content/puzzles/states");
const SAMPLES_OUT = resolve(ROOT, "scripts/out/states-samples.md");

interface StateEntry {
  code: string;
  name: string;
  path: string;
  viewBox: string;
  centroid: LonLat;
}

interface StateProperties {
  code: string;
  name: string;
}

function loadFeatures(): StateEntry[] {
  const topology = JSON.parse(readFileSync(SHARED_TOPOLOGY, "utf8")) as Topology;
  const objectKey = Object.keys(topology.objects)[0];
  const collection = feature(
    topology,
    topology.objects[objectKey] as GeometryCollection,
  ) as FeatureCollection<Geometry, StateProperties>;

  return collection.features.map((f) => {
    const { path, viewBox } = buildSilhouette(f);
    return {
      code: f.properties.code,
      name: f.properties.name,
      path,
      viewBox,
      centroid: centroid(f.geometry),
    };
  });
}

function maxPairwiseDistanceKm(entries: StateEntry[]): number {
  let max = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const d = distanceKm(entries[i].centroid, entries[j].centroid);
      if (d > max) max = d;
    }
  }
  return max;
}

function writeSilhouettes(entries: StateEntry[], maxDistanceKm: number): void {
  const states: Record<string, Omit<StateEntry, "code">> = {};
  for (const { code, ...rest } of entries) states[code] = rest;

  mkdirSync(resolve(ROOT, "public/assets/states"), { recursive: true });
  writeFileSync(SILHOUETTES_OUT, JSON.stringify({ maxDistanceKm: Math.round(maxDistanceKm), states }));
}

function writeDayFiles(entries: StateEntry[]): string[] {
  const codes = entries.map((e) => e.code);
  const rng = mulberry32(SEED);
  const schedule = buildScheduleCodes(codes, rng, SCHEDULE_DAYS);
  if (schedule.length < SCHEDULE_DAYS) {
    throw new Error(`not enough states (${codes.length}) to fill ${SCHEDULE_DAYS} scheduled days`);
  }

  mkdirSync(CONTENT_DIR, { recursive: true });
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const code = schedule[i];
    writeFileSync(
      resolve(CONTENT_DIR, `${date}.json`),
      JSON.stringify({ payload: { code }, reserve: null }),
    );
  }
  return schedule;
}

function writeSamples(entries: StateEntry[], schedule: string[], maxDistanceKm: number): void {
  const byCode = new Map(entries.map((e) => [e.code, e]));
  const multiPolygonCount = entries.filter((e) => e.path.split("M").length - 1 > 1).length;

  const sampleDays = [0, 70, 150, 240, 330].filter((i) => i < schedule.length);
  const lines: string[] = [
    "# states — sample days",
    "",
    `Pool: ${entries.length} states/UTs. Schedule: ${schedule.length} days from ${LAUNCH_DATE}, ` +
      `cycling every ${entries.length} days (~${(schedule.length / entries.length).toFixed(1)} cycles).`,
    `India-scaled max centroid distance (used as proximity%'s 0% point): ${Math.round(maxDistanceKm)} km.`,
    `States/UTs rendered with more than one silhouette part (islands, enclaves): ${multiPolygonCount}.`,
    "",
    "## Sample days",
    "",
  ];

  for (const i of sampleDays) {
    const date = addDays(LAUNCH_DATE, i);
    const code = schedule[i];
    const s = byCode.get(code)!;
    lines.push(`- **Day ${dayIndex(date) + 1}** (${date}): \`${code}\` — ${s.name}`);
  }

  lines.push("", "## Full roster (alphabetical)", "");
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const parts = e.path.split("M").length - 1;
    lines.push(`- \`${e.code}\` ${e.name}${parts > 1 ? ` (${parts} parts)` : ""}`);
  }

  lines.push(
    "",
    "## Anything suspicious",
    "",
    "- Multi-part silhouettes (Andaman & Nicobar, Lakshadweep, Puducherry's 4 enclaves, Gujarat, " +
      "Maharashtra, Tamil Nadu, Uttar Pradesh, West Bengal, Andhra Pradesh, Kerala, Madhya Pradesh, " +
      "and the merged Dadra-Nagar-Haveli-Daman-Diu) render with real gaps between parts — expected, " +
      "not a bug (see RESEARCH.md §4).",
    "- Chandigarh, Delhi, Puducherry and Lakshadweep are geographically tiny but render at the same " +
      "visual size as Rajasthan — intentional (per-feature fit, see RESEARCH.md §4). The fit is to " +
      "each feature's largest contiguous part (redesign, 2026-10): Puducherry/Lakshadweep/Andaman & " +
      "Nicobar/Dadra-Nagar-Haveli-Daman-Diu are scattered multi-part territories where fitting to " +
      "the full bounding box shrank the actual landmass to well under 1% of the frame — see " +
      "scripts/states/silhouette.ts's `largestPart`.",
  );

  mkdirSync(resolve(ROOT, "scripts/out"), { recursive: true });
  writeFileSync(SAMPLES_OUT, lines.join("\n") + "\n");
}

function main(): void {
  const entries = loadFeatures();
  if (entries.length === 0) throw new Error("no states found in shared topology");

  const maxDistanceKm = maxPairwiseDistanceKm(entries);
  writeSilhouettes(entries, maxDistanceKm);
  const schedule = writeDayFiles(entries);
  writeSamples(entries, schedule, maxDistanceKm);

  console.log(
    `states: wrote ${entries.length} silhouettes, ${schedule.length} day files, and the samples report.`,
  );
}

main();
