// Builds content/puzzles/mini/<date>.json for every day of the schedule, plus
// scripts/out/mini-samples.md for human review. Run with: npx tsx scripts/mini/build.ts
//
// Pipeline (see RESEARCH.md for the reasoning behind each step):
//   1. Parse + validate every archive grid (data/mini/data.json), dropping the 6x6 one-off and
//      the two rebus-square puzzles this one-letter-per-cell UI can't represent.
//   2. Build a global answer -> ranked dataset clue candidates map from the CrosswordQA CSV.
//   3. Assign each valid grid its clues once (seed 41), falling back to written-clues.json.
//   4. Shuffle, then schedule: a unique grid per day (7x7 on Saturdays, 5x5 otherwise), with the
//      unused grids forming a reserve pool reused cyclically (as Connections does).
//   5. Write one content file per day, and a human-readable samples file.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHIVE_CUTOFF, LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, mulberry32, shuffle } from "../../src/lib/daily";
import type { MiniClue, MiniPuzzle } from "../../src/games/mini/logic";
import {
  assignMains,
  findIsolatedCells,
  isUsableClue,
  numberGrid,
  parseArchiveGrid,
  parseCsv,
  pickClue,
  rankClues,
  reserveFor,
  toMiniClue,
  type RawArchivePuzzle,
} from "./lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const SEED = 41;

interface ValidGrid {
  date: string;
  size: number;
  numbered: ReturnType<typeof numberGrid>;
}

interface DropReason {
  date: string;
  reason: string;
}

async function loadArchive(): Promise<{ valid: ValidGrid[]; dropped: DropReason[] }> {
  const raw = JSON.parse(
    await readFile(resolve(ROOT, "data/mini/data.json"), "utf8"),
  ) as RawArchivePuzzle[];

  const valid: ValidGrid[] = [];
  const dropped: DropReason[] = [];
  const seenDates = new Set<string>();

  for (const record of raw) {
    if (seenDates.has(record.print_date)) {
      dropped.push({ date: record.print_date, reason: "duplicate date in archive" });
      continue;
    }
    seenDates.add(record.print_date);

    if (record.print_date >= ARCHIVE_CUTOFF) {
      dropped.push({ date: record.print_date, reason: `on/after ARCHIVE_CUTOFF (${ARCHIVE_CUTOFF})` });
      continue;
    }

    const grid = parseArchiveGrid(record);
    if (!grid) {
      dropped.push({ date: record.print_date, reason: "non-letter cell (rebus square) or malformed" });
      continue;
    }
    if (grid.size !== 5 && grid.size !== 7) {
      dropped.push({ date: record.print_date, reason: `unsupported size ${grid.size}x${grid.size}` });
      continue;
    }

    const numbered = numberGrid(grid.size, grid.letters);
    const isolated = findIsolatedCells(grid.size, numbered);
    if (isolated.length > 0) {
      dropped.push({ date: record.print_date, reason: `${isolated.length} isolated cell(s)` });
      continue;
    }

    valid.push({ date: record.print_date, size: grid.size, numbered });
  }

  return { valid, dropped };
}

async function loadClueCandidates(): Promise<Map<string, string[]>> {
  const text = await readFile(resolve(ROOT, "data/mini/crosswordqa-valid.csv"), "utf8");
  const rows = parseCsv(text);
  const rawByAnswer = new Map<string, string[]>();

  for (let i = 1; i < rows.length; i++) {
    // "id,clue,answer" — answer may include spaces/punctuation from CrosswordQA's auto-segmented
    // phrases (e.g. "Buzz Lightyear"); strip to compare against our letters-only grid answers.
    const row = rows[i];
    if (row.length < 3) continue;
    const clue = row[1];
    const answer = row.slice(2).join(",").replace(/[^A-Za-z]/g, "").toUpperCase();
    if (!answer || !clue || !isUsableClue(clue)) continue;
    const list = rawByAnswer.get(answer);
    if (list) list.push(clue);
    else rawByAnswer.set(answer, [clue]);
  }

  const ranked = new Map<string, string[]>();
  for (const [answer, clues] of rawByAnswer) ranked.set(answer, rankClues(clues));
  return ranked;
}

function buildCluesForGrid(
  numbered: ReturnType<typeof numberGrid>,
  candidates: Map<string, string[]>,
  written: Record<string, string>,
  rng: () => number,
): { across: MiniClue[]; down: MiniClue[] } {
  const across = numbered.across.map((entry) => {
    const picked = pickClue(candidates.get(entry.answer), written[entry.answer], rng, 8, entry.answer);
    return toMiniClue(entry, picked);
  });
  const down = numbered.down.map((entry) => {
    const picked = pickClue(candidates.get(entry.answer), written[entry.answer], rng, 8, entry.answer);
    return toMiniClue(entry, picked);
  });
  return { across, down };
}

async function main() {
  const rng = mulberry32(SEED);

  const [{ valid, dropped }, candidates, written] = await Promise.all([
    loadArchive(),
    loadClueCandidates(),
    readFile(resolve(ROOT, "scripts/mini/written-clues.json"), "utf8").then(
      (text) => JSON.parse(text) as Record<string, string>,
    ),
  ]);

  const fivesRaw = shuffle(valid.filter((g) => g.size === 5), rng);
  const sevensRaw = shuffle(valid.filter((g) => g.size === 7), rng);

  // Clues are assigned once per distinct grid (not per day it's used) — a reused reserve grid
  // shows the exact same puzzle every time; "varied clues" means across *different* grids that
  // happen to share an answer, not across repeat showings of the same one.
  function toPuzzle(grid: ValidGrid): MiniPuzzle {
    const clues = buildCluesForGrid(grid.numbered, candidates, written, rng);
    return { size: grid.size, cells: grid.numbered.cells, clues };
  }
  const fives = fivesRaw.map(toPuzzle);
  const sevens = sevensRaw.map(toPuzzle);

  const days = Array.from({ length: SCHEDULE_DAYS }, (_, i) => addDays(LAUNCH_DATE, i));
  // assignMains throws (with the day it ran out on) if either pool can't cover its days —
  // the "throw if there aren't enough valid puzzles for every day" generator rule.
  const { mains, leftover } = assignMains(fives, sevens, days);
  const reservePool = shuffle(leftover, rng);

  const contentDir = resolve(ROOT, "content/puzzles/mini");
  await mkdir(contentDir, { recursive: true });

  for (let n = 0; n < days.length; n++) {
    const date = days[n];
    const payload = mains.get(date);
    if (!payload) throw new Error(`no main puzzle assigned for ${date}`);
    const reserve = reserveFor(reservePool, n);
    await writeFile(resolve(contentDir, `${date}.json`), JSON.stringify({ payload, reserve }, null, 2));
  }

  await writeSamples({ valid, dropped, fives, sevens, reservePool, days, mains });

  console.log(`Wrote ${days.length} day files to content/puzzles/mini/`);
  console.log(`Archive: ${valid.length} valid grids (${fives.length} 5x5, ${sevens.length} 7x7), ${dropped.length} dropped`);
  console.log(`Reserve pool: ${reservePool.length} leftover grids`);
}

function renderGrid(puzzle: MiniPuzzle): string {
  const lines: string[] = [];
  for (let r = 0; r < puzzle.size; r++) {
    let line = "";
    for (let c = 0; c < puzzle.size; c++) {
      const cell = puzzle.cells[r * puzzle.size + c];
      line += cell ? ` ${cell.answer} ` : " # ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function renderClues(clues: MiniClue[], label: string): string {
  return [`**${label}**`, ...clues.map((c) => `${c.number}. ${c.clue} — \`${c.answer}\` (${c.source})`)].join("\n");
}

async function writeSamples(args: {
  valid: ValidGrid[];
  dropped: DropReason[];
  fives: MiniPuzzle[];
  sevens: MiniPuzzle[];
  reservePool: MiniPuzzle[];
  days: string[];
  mains: Map<string, MiniPuzzle>;
}) {
  const { valid, dropped, fives, sevens, reservePool, days, mains } = args;

  const sampleRng = mulberry32(SEED + 1);
  const sampleDays = shuffle(days, sampleRng).slice(0, 5);

  const writtenCount = (puzzles: MiniPuzzle[]) =>
    puzzles.reduce(
      (n, p) => n + p.clues.across.filter((c) => c.source === "written").length + p.clues.down.filter((c) => c.source === "written").length,
      0,
    );
  const allPuzzles = [...fives, ...sevens];
  const totalEntries = allPuzzles.reduce((n, p) => n + p.clues.across.length + p.clues.down.length, 0);
  const writtenEntries = writtenCount(allPuzzles);

  const writtenList: string[] = [];
  for (const puzzle of allPuzzles) {
    for (const clue of [...puzzle.clues.across, ...puzzle.clues.down]) {
      if (clue.source === "written") writtenList.push(`${clue.answer} — "${clue.clue}"`);
    }
  }
  const uniqueWritten = [...new Set(writtenList)].sort();

  const lines: string[] = [];
  lines.push("# Mini crossword — samples & pool stats\n");
  lines.push("## Pool stats\n");
  lines.push(`- Archive records: ${valid.length + dropped.length}`);
  lines.push(`- Valid grids kept: ${valid.length} (${fives.length} 5x5, ${sevens.length} 7x7)`);
  lines.push(`- Dropped: ${dropped.length}`);
  lines.push(`- Schedule: ${days.length} days, ${new Set(mains.values()).size} unique main grids used`);
  lines.push(`- Reserve pool size: ${reservePool.length}`);
  lines.push(`- Total clue entries across the archive: ${totalEntries}`);
  lines.push(`- Written (hand-authored) clue entries: ${writtenEntries} (${((writtenEntries / totalEntries) * 100).toFixed(1)}%)`);
  lines.push("");
  lines.push("### Dropped grids\n");
  if (dropped.length === 0) lines.push("None.");
  for (const d of dropped) lines.push(`- ${d.date}: ${d.reason}`);
  lines.push("");
  lines.push(`### Every hand-written clue used (${uniqueWritten.length} unique answers)\n`);
  for (const w of uniqueWritten) lines.push(`- ${w}`);
  lines.push("");
  lines.push("## 5 random days\n");
  for (const date of sampleDays) {
    const puzzle = mains.get(date)!;
    lines.push(`### ${date} (${puzzle.size}x${puzzle.size})\n`);
    lines.push("```");
    lines.push(renderGrid(puzzle));
    lines.push("```\n");
    lines.push(renderClues(puzzle.clues.across, "Across"));
    lines.push("");
    lines.push(renderClues(puzzle.clues.down, "Down"));
    lines.push("");
  }

  await mkdir(resolve(ROOT, "scripts/out"), { recursive: true });
  await writeFile(resolve(ROOT, "scripts/out/mini-samples.md"), lines.join("\n"));
}

await main();
