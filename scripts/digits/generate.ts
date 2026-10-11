// Deterministic generator for the Digits daily puzzles — see src/games/digits/RESEARCH.md
// "Chosen approach — generator" for the full design rationale.
//
// Usage: npx tsx scripts/digits/generate.ts
//   Writes content/puzzles/digits/<date>.json for LAUNCH_DATE .. LAUNCH_DATE + SCHEDULE_DAYS - 1,
//   and scripts/out/digits-samples.md for human review.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, mulberry32 } from "../../src/lib/daily";
import {
  ROUNDS_PER_DAY,
  minStepsTo,
  reachableInOneStep,
  type DigitsPuzzle,
  type DigitsRound,
} from "../../src/games/digits/logic";

export const SEED = 21;

const NUMBER_MIN = 1;
const NUMBER_MAX = 25;
const NUMBERS_PER_ROUND = 6;
const MAX_ATTEMPTS_PER_ROUND = 2000;

/** Simple string hash (same approach as the local data adapter's fake-friends RNG seeding). */
export function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return h >>> 0;
}

/**
 * Round i's target range widens and shifts upward with the round index, so a day's 5 rounds have
 * a gentle difficulty ramp (round 1 easiest, round 5 hardest) — see RESEARCH.md.
 */
export function targetRange(roundIndex: number): [number, number] {
  return [40 + 60 * roundIndex, 150 + 160 * roundIndex];
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Draws candidate (numbers, target) pairs from `rng` until one is exactly solvable in >= 2 steps
 * (rejecting targets already present among the numbers, unsolvable targets, and 1-step targets —
 * all per the task prompt's "exactly reachable and not reachable in one step"). Throws if none is
 * found within a generous attempt cap, per CLAUDE.md "Generators: throw if there aren't enough
 * valid puzzles."
 */
export function generateRound(rng: () => number, roundIndex: number): DigitsRound {
  const [lo, hi] = targetRange(roundIndex);
  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_ROUND; attempt++) {
    const numbers = Array.from({ length: NUMBERS_PER_ROUND }, () =>
      randInt(rng, NUMBER_MIN, NUMBER_MAX),
    );
    const target = randInt(rng, lo, hi);
    if (numbers.includes(target)) continue;
    const minSteps = minStepsTo(numbers, target);
    if (minSteps === undefined || minSteps < 2) continue;
    if (reachableInOneStep(numbers, target)) continue; // defensive, same guarantee as minSteps < 2
    return { numbers, target, minSteps };
  }
  throw new Error(
    `digits generator: no valid round ${roundIndex} found in ${MAX_ATTEMPTS_PER_ROUND} attempts`,
  );
}

export function generateDay(date: string): DigitsPuzzle {
  const rounds: DigitsRound[] = [];
  for (let r = 0; r < ROUNDS_PER_DAY; r++) {
    const rng = mulberry32(hashString(`digits:${SEED}:${date}:${r}`));
    rounds.push(generateRound(rng, r));
  }
  return { rounds };
}

interface PoolStats {
  days: number;
  rounds: number;
  minStepsCounts: Record<number, number>;
  targetMin: number;
  targetMax: number;
}

function collectStats(puzzlesByDate: Map<string, DigitsPuzzle>): PoolStats {
  const stats: PoolStats = {
    days: puzzlesByDate.size,
    rounds: 0,
    minStepsCounts: {},
    targetMin: Infinity,
    targetMax: -Infinity,
  };
  for (const puzzle of puzzlesByDate.values()) {
    for (const round of puzzle.rounds) {
      stats.rounds += 1;
      stats.minStepsCounts[round.minSteps] = (stats.minStepsCounts[round.minSteps] ?? 0) + 1;
      stats.targetMin = Math.min(stats.targetMin, round.target);
      stats.targetMax = Math.max(stats.targetMax, round.target);
    }
  }
  return stats;
}

function renderRound(round: DigitsRound): string {
  return `numbers: ${round.numbers.join(", ")} · target: **${round.target}** · minSteps: ${round.minSteps}`;
}

function renderSamples(puzzlesByDate: Map<string, DigitsPuzzle>, sampleDates: string[]): string {
  const stats = collectStats(puzzlesByDate);
  const lines: string[] = [
    "# digits — generator samples",
    "",
    `Seed ${SEED}. ${stats.days} days × ${ROUNDS_PER_DAY} rounds = ${stats.rounds} rounds generated.`,
    "",
    "## Pool stats",
    "",
    `- Target range seen: ${stats.targetMin}–${stats.targetMax}`,
    `- minSteps distribution: ${Object.entries(stats.minStepsCounts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([steps, count]) => `${steps} steps × ${count}`)
      .join(", ")}`,
    "- Every round above is independently re-verified solvable (and not 1-step-solvable) by",
    "  feeding it back through the solver — see `generate.test.ts`.",
    "",
    "## Sample days",
    "",
  ];
  for (const date of sampleDates) {
    const puzzle = puzzlesByDate.get(date);
    if (!puzzle) continue;
    lines.push(`### ${date}`, "");
    puzzle.rounds.forEach((round, i) => lines.push(`${i + 1}. ${renderRound(round)}`));
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const contentDir = resolve(root, "content/puzzles/digits");
  await mkdir(contentDir, { recursive: true });

  const puzzlesByDate = new Map<string, DigitsPuzzle>();
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const puzzle = generateDay(date);
    puzzlesByDate.set(date, puzzle);
    const file = resolve(contentDir, `${date}.json`);
    await writeFile(file, JSON.stringify({ payload: puzzle, reserve: null }, null, 2) + "\n", "utf8");
  }

  const sampleRng = mulberry32(hashString(`digits:${SEED}:samples`));
  const allDates = [...puzzlesByDate.keys()];
  const sampleDates: string[] = [];
  const pool = [...allDates];
  for (let i = 0; i < 5 && pool.length > 0; i++) {
    const idx = Math.floor(sampleRng() * pool.length);
    sampleDates.push(pool[idx]);
    pool.splice(idx, 1);
  }
  sampleDates.sort();

  const outDir = resolve(root, "scripts/out");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    resolve(outDir, "digits-samples.md"),
    renderSamples(puzzlesByDate, sampleDates),
    "utf8",
  );

  console.log(`digits: wrote ${puzzlesByDate.size} day files and scripts/out/digits-samples.md`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
