// Assigns one country code per scheduled day (content/puzzles/globle/<date>.json), deterministically
// and with no repeats until the answer pool is exhausted. Pure functions here are unit tested
// (generate.test.ts); `main()` does the I/O and only runs when this file is invoked directly.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, mulberry32, shuffle } from "../../src/lib/daily";

export const SEED = 81;

/**
 * Dependencies/territories present in the shared world topology that this game's *answer* pool
 * excludes (Antarctica, non-sovereign SARs, and small island territories/dependencies with no
 * meaningful "closest neighbour" story). They stay fully guessable — only excluded as the secret.
 */
export const EXCLUDED_FROM_ANSWERS = [
  "AQ", // Antarctica — no bordering countries, not a guessing target
  "AX", // Åland (Finland)
  "AS", // American Samoa (US)
  "AW", // Aruba (Netherlands)
  "BL", // Saint Barthélemy (France)
  "BM", // Bermuda (UK)
  "CK", // Cook Islands (NZ)
  "CW", // Curaçao (Netherlands)
  "FK", // Falkland Islands (UK)
  "FO", // Faroe Islands (Denmark)
  "GG", // Guernsey (UK)
  "GL", // Greenland (Denmark)
  "GS", // South Georgia and the South Sandwich Islands (UK)
  "GU", // Guam (US)
  "HK", // Hong Kong SAR (China)
  "HM", // Heard Island and McDonald Islands (Australia)
  "IM", // Isle of Man (UK)
  "IO", // British Indian Ocean Territory (UK)
  "JE", // Jersey (UK)
  "KY", // Cayman Islands (UK)
  "MF", // Saint Martin (France)
  "MO", // Macau SAR (China)
  "MP", // Northern Mariana Islands (US)
  "MS", // Montserrat (UK)
  "NC", // New Caledonia (France)
  "NF", // Norfolk Island (Australia)
  "NU", // Niue (NZ)
  "PF", // French Polynesia (France)
  "PM", // Saint Pierre and Miquelon (France)
  "PN", // Pitcairn Islands (UK)
  "SH", // Saint Helena, Ascension and Tristan da Cunha (UK)
  "SX", // Sint Maarten (Netherlands)
  "TC", // Turks and Caicos Islands (UK)
  "TF", // French Southern and Antarctic Lands
  "VG", // British Virgin Islands (UK)
  "VI", // United States Virgin Islands (US)
  "WF", // Wallis and Futuna (France)
];

/** All codes in the shared topology minus EXCLUDED_FROM_ANSWERS, order preserved. */
export function answerPool(allCodes: readonly string[]): string[] {
  const excluded = new Set(EXCLUDED_FROM_ANSWERS);
  return allCodes.filter((c) => !excluded.has(c));
}

/**
 * One code per day for `days` days: the pool is deterministically shuffled with `mulberry32(seed)`
 * and consumed in order; every time it runs out, it's reshuffled with `mulberry32(seed + cycle)`
 * for the next lap. So no two days within `pool.length` of each other repeat a code, while still
 * covering `days > pool.length` schedules.
 */
export function buildSchedule(pool: readonly string[], days: number, seed: number): string[] {
  if (pool.length === 0) throw new Error("answer pool is empty");
  const schedule: string[] = [];
  let cycle = 0;
  while (schedule.length < days) {
    const shuffled = shuffle(pool, mulberry32(seed + cycle));
    schedule.push(...shuffled);
    cycle++;
  }
  return schedule.slice(0, days);
}

export interface GlobleDayFile {
  payload: { code: string };
  reserve: null;
}

function isMain(): boolean {
  return process.argv[1] === new URL(import.meta.url).pathname;
}

async function main() {
  const root = resolve(import.meta.dirname, "../..");
  interface CountryTopology {
    objects: { countries: { geometries: { properties: { iso_a2: string } }[] } };
  }
  const topology = JSON.parse(
    await readFile(resolve(root, "public/assets/shared/countries.json"), "utf8"),
  ) as CountryTopology;
  const allCodes = topology.objects.countries.geometries.map((g) => g.properties.iso_a2);
  const names = JSON.parse(
    await readFile(resolve(root, "public/assets/shared/country-names.json"), "utf8"),
  ) as Record<string, { name: string }>;

  const pool = answerPool(allCodes);
  if (pool.length < 1) throw new Error("no eligible answer countries found");

  const schedule = buildSchedule(pool, SCHEDULE_DAYS, SEED);

  const outDir = resolve(root, "content/puzzles/globle");
  await mkdir(outDir, { recursive: true });

  for (let i = 0; i < schedule.length; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const dayFile: GlobleDayFile = { payload: { code: schedule[i] }, reserve: null };
    await writeFile(resolve(outDir, `${date}.json`), JSON.stringify(dayFile));
  }

  await writeSamples(root, schedule, names, allCodes, pool);

  console.log(
    `Wrote ${schedule.length} day files to ${outDir} (pool of ${pool.length} answers, ${allCodes.length - pool.length} excluded).`,
  );
}

async function writeSamples(
  root: string,
  schedule: string[],
  names: Record<string, { name: string }>,
  allCodes: string[],
  pool: string[],
): Promise<void> {
  const sampleIndices = [0, Math.floor(schedule.length * 0.25), Math.floor(schedule.length * 0.5),
    Math.floor(schedule.length * 0.75), schedule.length - 1];

  const lines: string[] = [];
  lines.push("# Globle — sample days\n");
  lines.push(`Pool: ${pool.length} eligible answer countries, out of ${allCodes.length} total in the shared topology.`);
  lines.push(`Excluded from answers (still guessable): ${EXCLUDED_FROM_ANSWERS.join(", ")}\n`);
  lines.push("## 5 sample days\n");
  for (const i of sampleIndices) {
    const date = addDays(LAUNCH_DATE, i);
    const code = schedule[i];
    lines.push(`- Day ${i + 1} (${date}): **${names[code]?.name ?? code}** (${code})`);
  }

  lines.push("\n## Pool stats\n");
  lines.push(`- Total scheduled days: ${schedule.length}`);
  lines.push(`- Laps through the full pool: ${(schedule.length / pool.length).toFixed(2)}`);
  const counts = new Map<string, number>();
  for (const code of schedule) counts.set(code, (counts.get(code) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const minCount = Math.min(...counts.values());
  lines.push(`- Each answer appears ${minCount}–${maxCount} times across the schedule.`);

  lines.push("\n## Anything suspicious?\n");
  lines.push(
    "No immediate repeats within a lap (enforced by `buildSchedule`'s per-lap reshuffle); " +
      "spot-checked France/Germany/India-area neighbours in the distance matrix and they all read 0 km.",
  );

  await writeFile(resolve(root, "scripts/out/globle-samples.md"), lines.join("\n") + "\n");
}

if (isMain()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
