#!/usr/bin/env node
// Usage: npx tsx scripts/quordle/generate.ts [--exclude <dir>]
// Writes content/puzzles/quordle/<date>.json for LAUNCH_DATE..LAUNCH_DATE+SCHEDULE_DAYS-1,
// public/assets/quordle/guesses.json, and scripts/out/quordle-samples.md.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, mulberry32, shuffle } from "../../src/lib/daily";
import { assignDailyAnswers } from "./schedule";
import { loadWordPools, type WordPools } from "./wordlist";

export const SEED = 2;
export const BOARDS_PER_DAY = 4;

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "../..");

export function parseArgs(argv: string[]): { excludeDir?: string } {
  const out: { excludeDir?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--exclude") out.excludeDir = argv[++i];
  }
  return out;
}

export function allDays(): string[] {
  return Array.from({ length: SCHEDULE_DAYS }, (_, i) => addDays(LAUNCH_DATE, i));
}

/**
 * Reads `<dir>/<date>.json` (a day file — `{ payload, reserve }`) and pulls out the single answer
 * it holds, if any. Tolerates either a `payload.answer` string field or a bare string payload,
 * since the Wordle agent builds its own day file independently and in parallel (CLAUDE.md,
 * "Generators" / "Parallel work rules") — this generator doesn't import its code or know its exact
 * shape ahead of time. Missing file (nothing released for that day yet) -> undefined, not an error.
 */
export async function readExcludedAnswer(dir: string, date: string): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await readFile(resolve(dir, `${date}.json`), "utf8");
  } catch {
    return undefined;
  }
  const data = JSON.parse(raw) as { payload?: unknown };
  const payload = data.payload;
  if (typeof payload === "string") return payload.toUpperCase();
  if (payload && typeof payload === "object" && "answer" in payload) {
    const answer = (payload as { answer: unknown }).answer;
    if (typeof answer === "string") return answer.toUpperCase();
  }
  return undefined;
}

/** Builds the date -> excluded-word map for `--exclude <dir>`; empty map when `excludeDir` is unset. */
export async function buildExclusionMap(
  days: string[],
  excludeDir: string | undefined,
): Promise<Map<string, string | undefined>> {
  const excludedByDate = new Map<string, string | undefined>();
  if (!excludeDir) return excludedByDate;
  for (const date of days) {
    excludedByDate.set(date, await readExcludedAnswer(excludeDir, date));
  }
  return excludedByDate;
}

async function writeSamples(
  days: string[],
  assignments: Map<string, string[]>,
  pools: WordPools,
): Promise<void> {
  const sampleDays = shuffle(days, mulberry32(SEED + 1))
    .slice(0, 5)
    .sort();

  const allAnswers = days.flatMap((d) => assignments.get(d)!);
  const uniqueAnswers = new Set(allAnswers);
  const duplicates = allAnswers.length - uniqueAnswers.size;

  const lines: string[] = [
    "# Quordle — sample days",
    "",
    `Fair-answer pool: ${pools.fairAnswers.length} candidates. Valid guesses: ${pools.validGuesses.length} words.`,
    `Schedule: ${days.length} days x ${BOARDS_PER_DAY} boards = ${allAnswers.length} answers used, ` +
      `${uniqueAnswers.size} unique.`,
    duplicates === 0
      ? "No answer repeats anywhere in the schedule."
      : `⚠ ${duplicates} answer(s) repeat somewhere in the schedule — check the pool size.`,
    "",
  ];
  for (const date of sampleDays) {
    lines.push(`## ${date}`);
    for (const word of assignments.get(date)!) lines.push(`- ${word}`);
    lines.push("");
  }
  await mkdir(resolve(REPO_ROOT, "scripts/out"), { recursive: true });
  await writeFile(resolve(REPO_ROOT, "scripts/out/quordle-samples.md"), lines.join("\n"), "utf8");
}

export async function main(): Promise<void> {
  const { excludeDir } = parseArgs(process.argv.slice(2));
  const pools = await loadWordPools(REPO_ROOT);
  const days = allDays();
  const excludedByDate = await buildExclusionMap(
    days,
    excludeDir ? resolve(REPO_ROOT, excludeDir) : undefined,
  );

  const assignments = assignDailyAnswers({
    seed: SEED,
    days,
    pool: pools.fairAnswers,
    excludedByDate,
    boardsPerDay: BOARDS_PER_DAY,
  });

  const puzzlesDir = resolve(REPO_ROOT, "content/puzzles/quordle");
  await mkdir(puzzlesDir, { recursive: true });
  for (const date of days) {
    const file = { payload: { answers: assignments.get(date) }, reserve: null };
    await writeFile(resolve(puzzlesDir, `${date}.json`), JSON.stringify(file), "utf8");
  }

  const assetsDir = resolve(REPO_ROOT, "public/assets/quordle");
  await mkdir(assetsDir, { recursive: true });
  await writeFile(resolve(assetsDir, "guesses.json"), JSON.stringify(pools.validGuesses), "utf8");

  await writeSamples(days, assignments, pools);
  console.log(
    `quordle: wrote ${days.length} day files, ${pools.validGuesses.length} valid guesses` +
      (excludeDir ? ` (excluding answers from ${excludeDir})` : ""),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
