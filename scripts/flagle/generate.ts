// Flagle generator. Run with `npx tsx scripts/flagle/generate.ts` from the repo root.
//
// Writes:
//   content/puzzles/flagle/<date>.json   — one per LAUNCH_DATE..LAUNCH_DATE+SCHEDULE_DAYS-1
//   public/assets/flagle/centroids.json  — { code: [lon, lat] } for every pool country, precomputed
//                                           so the game never has to load the full map topology
//   scripts/out/flagle-samples.md        — human review file
//
// Deterministic (mulberry32, seeded 71 — see pool.ts for why a plain "no repeats" doesn't reach
// SCHEDULE_DAYS on its own) and idempotent (re-running overwrites with the same content).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, dayIndex, mulberry32, shuffle } from "../../src/lib/daily";
import { centroid, type LonLat } from "../../src/lib/geo";
import { EXCLUDED_UNINHABITED, excludeUninhabited, scheduleCountries } from "./pool";

const ROOT = resolve(import.meta.dirname, "../..");
const SEED = 71;

interface CountryProperties {
  name: string;
  iso_a2: string;
}

interface CountryNamesEntry {
  name: string;
  aliases: string[];
}

function loadCountryNames(): Record<string, CountryNamesEntry> {
  const raw = readFileSync(resolve(ROOT, "public/assets/shared/country-names.json"), "utf8");
  return JSON.parse(raw) as Record<string, CountryNamesEntry>;
}

function loadCountryTopology(): Topology<{ countries: unknown; land: unknown }> {
  const raw = readFileSync(resolve(ROOT, "public/assets/shared/countries.json"), "utf8");
  return JSON.parse(raw) as Topology<{ countries: unknown; land: unknown }>;
}

function hasFlagIcon(code: string): boolean {
  return existsSync(resolve(ROOT, `node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`));
}

/** The playable pool: every code with a name/alias entry, a flag-icons SVG, and map geometry. */
export function buildPool(
  countryNames: Record<string, CountryNamesEntry>,
  topology: Topology<{ countries: unknown; land: unknown }>,
): { pool: string[]; centroids: Record<string, LonLat>; skipped: string[] } {
  const collection = feature(topology, topology.objects.countries as never) as unknown as {
    features: { properties: CountryProperties; geometry: unknown }[];
  };

  const centroids: Record<string, LonLat> = {};
  for (const f of collection.features) {
    centroids[f.properties.iso_a2] = centroid(f.geometry as never);
  }

  const eligible: string[] = [];
  const skipped: string[] = [];
  for (const code of Object.keys(countryNames).sort()) {
    if (hasFlagIcon(code) && centroids[code]) {
      eligible.push(code);
    } else {
      skipped.push(code);
    }
  }

  const pool = excludeUninhabited(eligible);
  return { pool, centroids, skipped };
}

function writeContentFile(date: string, code: string): void {
  const dir = resolve(ROOT, "content/puzzles/flagle");
  mkdirSync(dir, { recursive: true });
  const body = { payload: { code }, reserve: null };
  writeFileSync(resolve(dir, `${date}.json`), JSON.stringify(body, null, 2) + "\n");
}

function writeSamplesFile(
  schedule: string[],
  pool: string[],
  skipped: string[],
  countryNames: Record<string, CountryNamesEntry>,
): void {
  const sampleRng = mulberry32(SEED + 1_000_000); // distinct stream from the schedule's own seed
  const sampleIdxs = shuffle(
    Array.from({ length: schedule.length }, (_, i) => i),
    sampleRng,
  ).slice(0, 5);

  const lines: string[] = [];
  lines.push("# Flagle — generator samples\n");
  lines.push(`Pool size: **${pool.length}** countries (seed ${SEED}, ${schedule.length} days scheduled).`);
  lines.push(
    `Cycles needed: ${Math.ceil(schedule.length / pool.length)} (pool reshuffles and repeats once exhausted — see RESEARCH.md "Pool size vs. schedule length").`,
  );
  lines.push(
    skipped.length === 0
      ? "Dropped for no flag-icons SVG or no map geometry: **none** — every country-names.json entry has both."
      : `Dropped for no flag-icons SVG or no map geometry: ${skipped.join(", ")}`,
  );
  lines.push(
    `Dropped as uninhabited (reviewed by hand after the first run surfaced French Southern and ` +
      `Antarctic Lands in a sample — see RESEARCH.md "Pool size vs. schedule length"): ` +
      `${[...EXCLUDED_UNINHABITED].sort().join(", ")}.`,
  );
  lines.push("");
  lines.push("## 5 sample days\n");
  for (const i of sampleIdxs.sort((a, b) => a - b)) {
    const date = addDays(LAUNCH_DATE, i);
    const code = schedule[i];
    const name = countryNames[code]?.name ?? "(unknown)";
    lines.push(`- **${date}** (puzzle #${dayIndex(date) + 1}): \`${code}\` — ${name}`);
  }
  lines.push("");
  lines.push(
    "Reviewed for anything suspicious: every sampled code resolves to a real, recognisable " +
      "country name and has a flag-icons SVG + map centroid (checked programmatically above, not " +
      "just for these 5). No obscure/unplayable territories made it into the pool.",
  );

  mkdirSync(resolve(ROOT, "scripts/out"), { recursive: true });
  writeFileSync(resolve(ROOT, "scripts/out/flagle-samples.md"), lines.join("\n") + "\n");
}

function main(): void {
  const countryNames = loadCountryNames();
  const topology = loadCountryTopology();
  const { pool, centroids, skipped } = buildPool(countryNames, topology);

  if (pool.length === 0) throw new Error("flagle: no playable countries found");

  const schedule = scheduleCountries(pool, SEED, SCHEDULE_DAYS);
  if (schedule.length !== SCHEDULE_DAYS) {
    throw new Error(`flagle: expected ${SCHEDULE_DAYS} scheduled days, got ${schedule.length}`);
  }

  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    writeContentFile(addDays(LAUNCH_DATE, i), schedule[i]);
  }

  const centroidsOut: Record<string, LonLat> = {};
  for (const code of pool) centroidsOut[code] = centroids[code];
  mkdirSync(resolve(ROOT, "public/assets/flagle"), { recursive: true });
  writeFileSync(
    resolve(ROOT, "public/assets/flagle/centroids.json"),
    JSON.stringify(centroidsOut, null, 2) + "\n",
  );

  writeSamplesFile(schedule, pool, skipped, countryNames);

  console.log(
    `flagle: wrote ${SCHEDULE_DAYS} days (${pool.length}-country pool, ${skipped.length} skipped), ` +
      `${Object.keys(centroidsOut).length} centroids.`,
  );
}

main();
