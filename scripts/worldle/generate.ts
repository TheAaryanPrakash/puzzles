// Writes content/puzzles/worldle/<date>.json for every day in [LAUNCH_DATE, LAUNCH_DATE +
// SCHEDULE_DAYS - 1], plus scripts/out/worldle-samples.md. Run with `npx tsx scripts/worldle/generate.ts`.
// Deterministic and idempotent: same inputs always produce the same output files.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, dayIndex } from "../../src/lib/daily";
import { assignDays } from "./pool";
import { EXCLUDED_TERRITORIES } from "./excluded";
import type { SilhouetteEntry } from "./build-silhouettes";

const ROOT = resolve(import.meta.dirname, "../..");
const SILHOUETTES_PATH = resolve(ROOT, "public/assets/worldle/silhouettes.json");
const NAMES_PATH = resolve(ROOT, "public/assets/shared/country-names.json");
const CONTENT_DIR = resolve(ROOT, "content/puzzles/worldle");
const SAMPLES_PATH = resolve(ROOT, "scripts/out/worldle-samples.md");

const SEED = 61;

interface CountryNames {
  [code: string]: { name: string; aliases: string[] };
}

function loadSilhouettes(): Record<string, SilhouetteEntry> {
  if (!existsSync(SILHOUETTES_PATH)) {
    throw new Error(
      `worldle: ${SILHOUETTES_PATH} is missing — run build-silhouettes.ts first`,
    );
  }
  return JSON.parse(readFileSync(SILHOUETTES_PATH, "utf8")) as Record<string, SilhouetteEntry>;
}

function buildSamplesMarkdown(
  dates: string[],
  codeForDate: Map<string, string>,
  names: CountryNames,
  poolSize: number,
): string {
  // 5 days spread evenly across the schedule, for a human to spot-check at a glance.
  const sampleCount = Math.min(5, dates.length);
  const sampleDates = Array.from({ length: sampleCount }, (_, i) =>
    dates[Math.floor((i * (dates.length - 1)) / Math.max(sampleCount - 1, 1))],
  );

  const lines: string[] = [];
  lines.push("# Worldle — generated puzzle samples");
  lines.push("");
  lines.push(`- Pool size (playable countries): **${poolSize}**`);
  lines.push(`- Schedule: ${dates.length} days, ${dates[0]} → ${dates[dates.length - 1]}`);
  lines.push(`- Seed: ${SEED}`);
  lines.push(
    `- Cycles through the whole pool before any repeat (${poolSize} days/cycle; day ${poolSize + 1} is the first possible repeat).`,
  );
  lines.push("");
  lines.push(`## Excluded territories (${EXCLUDED_TERRITORIES.length})`);
  lines.push("");
  lines.push("Non-sovereign/very small — see RESEARCH.md for the full reasoning.");
  lines.push("");
  lines.push("| Code | Name | Why excluded |");
  lines.push("|---|---|---|");
  for (const t of EXCLUDED_TERRITORIES) {
    lines.push(`| ${t.code} | ${t.name} | ${t.reason} |`);
  }
  lines.push("");
  lines.push("## 5 sample days");
  lines.push("");
  for (const date of sampleDates) {
    const code = codeForDate.get(date)!;
    const entry = names[code];
    lines.push(`### ${date} (puzzle #${dayIndex(date) + 1})`);
    lines.push(`- Answer: **${entry?.name ?? code}** (\`${code}\`)`);
    lines.push(`- Aliases accepted: ${entry?.aliases?.length ? entry.aliases.join(", ") : "—"}`);
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  const silhouettes = loadSilhouettes();
  const names = JSON.parse(readFileSync(NAMES_PATH, "utf8")) as CountryNames;
  const pool = Object.keys(silhouettes).sort();

  if (pool.length === 0) throw new Error("worldle: silhouette pool is empty");

  const dates = Array.from({ length: SCHEDULE_DAYS }, (_, i) => addDays(LAUNCH_DATE, i));
  const codes = assignDays(pool, SCHEDULE_DAYS, SEED);

  mkdirSync(CONTENT_DIR, { recursive: true });
  const codeForDate = new Map<string, string>();
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const code = codes[i];
    codeForDate.set(date, code);
    const file = resolve(CONTENT_DIR, `${date}.json`);
    writeFileSync(file, JSON.stringify({ payload: { code }, reserve: null }));
  }

  mkdirSync(resolve(ROOT, "scripts/out"), { recursive: true });
  writeFileSync(SAMPLES_PATH, buildSamplesMarkdown(dates, codeForDate, names, pool.length));

  console.log(`worldle: wrote ${dates.length} day files to ${CONTENT_DIR}`);
  console.log(`worldle: wrote samples to ${SAMPLES_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
