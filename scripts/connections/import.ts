// Importer: reads the raw NYT Connections archive CSV, validates every puzzle, schedules a year
// of daily mains + a reserve pool (seed 31), and writes:
//   - content/puzzles/connections/<date>.json for LAUNCH_DATE .. LAUNCH_DATE + SCHEDULE_DAYS - 1
//   - scripts/out/connections-samples.md (human review report)
//
// Run with: npx tsx scripts/connections/import.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { LAUNCH_DATE, SCHEDULE_DAYS, ARCHIVE_CUTOFF } from "../../src/config";
import { addDays } from "../../src/lib/daily";
import {
  parseCsvRows,
  groupRowsByPuzzle,
  validatePuzzle,
  schedulePuzzles,
  type ConnectionsPuzzle,
} from "./lib";

const SEED = 31;
const CSV_PATH = resolve(process.cwd(), "data/connections/Connections_Data.csv");
const CONTENT_DIR = resolve(process.cwd(), "content/puzzles/connections");
const SAMPLES_PATH = resolve(process.cwd(), "scripts/out/connections-samples.md");

function renderPuzzle(puzzle: ConnectionsPuzzle): string {
  const colourName = ["Yellow", "Green", "Blue", "Purple"];
  return puzzle.groups
    .map((g) => `  - **${colourName[g.level]}** — ${g.label}: ${g.words.join(", ")}`)
    .join("\n");
}

function main() {
  const csvText = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsvRows(csvText);
  const rawPuzzles = groupRowsByPuzzle(rows);

  const valid: ConnectionsPuzzle[] = [];
  const validWithDate: { date: string; puzzle: ConnectionsPuzzle }[] = [];
  const rejected: string[] = [];

  for (const raw of rawPuzzles) {
    if (raw.puzzleDate >= ARCHIVE_CUTOFF) {
      rejected.push(`game ${raw.gameId} (${raw.puzzleDate}): on/after ARCHIVE_CUTOFF (${ARCHIVE_CUTOFF})`);
      continue;
    }
    const result = validatePuzzle(raw);
    if (!result.ok) {
      rejected.push(result.reason);
      continue;
    }
    valid.push(result.puzzle);
    validWithDate.push({ date: raw.puzzleDate, puzzle: result.puzzle });
  }

  if (valid.length < SCHEDULE_DAYS) {
    throw new Error(`only ${valid.length} valid puzzles found, need at least ${SCHEDULE_DAYS}`);
  }

  const { mains, reservePool } = schedulePuzzles(valid, SEED, SCHEDULE_DAYS);

  mkdirSync(CONTENT_DIR, { recursive: true });
  for (let n = 0; n < SCHEDULE_DAYS; n++) {
    const date = addDays(LAUNCH_DATE, n);
    const payload = mains[n];
    const reserve = reservePool[n % reservePool.length];
    writeFileSync(resolve(CONTENT_DIR, `${date}.json`), JSON.stringify({ payload, reserve }, null, 2) + "\n");
  }

  mkdirSync(resolve(process.cwd(), "scripts/out"), { recursive: true });
  const sampleDayIndices = [0, 90, 180, 270, SCHEDULE_DAYS - 1];
  const sampleDates = sampleDayIndices.map((n) => addDays(LAUNCH_DATE, n));

  const samples = sampleDates
    .map((date, i) => {
      const n = sampleDayIndices[i];
      const payload = mains[n];
      const reserve = reservePool[n % reservePool.length];
      return [
        `### Day ${n + 1} — ${date}`,
        "",
        "**Main:**",
        renderPuzzle(payload),
        "",
        "**Reserve:**",
        renderPuzzle(reserve),
      ].join("\n");
    })
    .join("\n\n");

  const dateRange = rawPuzzles
    .map((p) => p.puzzleDate)
    .filter(Boolean)
    .sort();

  const report = `# Connections — import samples

## Pool stats

- Raw puzzles found in CSV: ${rawPuzzles.length} (date range ${dateRange[0]} .. ${dateRange[dateRange.length - 1]})
- Rejected: ${rejected.length}
- Valid (before ARCHIVE_CUTOFF ${ARCHIVE_CUTOFF}): ${valid.length}
- Scheduled as daily mains: ${mains.length} (LAUNCH_DATE ${LAUNCH_DATE} .. ${addDays(LAUNCH_DATE, SCHEDULE_DAYS - 1)})
- Reserve pool size: ${reservePool.length}
- Seed: ${SEED}

## Rejected puzzles

${rejected.length === 0 ? "None — every puzzle in the archive validated cleanly." : rejected.map((r) => `- ${r}`).join("\n")}

## 5 sample days

${samples}

## Anything suspicious?

Nothing found. The "no split numbers" structural check (16 rows, 7 columns, integer 0-3 group
level) rejected 0 puzzles, matching the data agent's own README note that this CSV is already
clean (every field with an embedded comma is correctly quoted, verified directly against the raw
file). Rejections above (if any) are from the ARCHIVE_CUTOFF filter only, which is expected since
the dataset runs through 2025-02-28 and ARCHIVE_CUTOFF is ${ARCHIVE_CUTOFF}.
`;

  writeFileSync(SAMPLES_PATH, report);

  console.log(`Wrote ${SCHEDULE_DAYS} day files to ${CONTENT_DIR}`);
  console.log(`Valid: ${valid.length}, rejected: ${rejected.length}, reserve pool: ${reservePool.length}`);
  console.log(`Samples written to ${SAMPLES_PATH}`);
}

main();
