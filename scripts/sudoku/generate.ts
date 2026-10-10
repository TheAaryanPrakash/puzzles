#!/usr/bin/env tsx
// Writes content/puzzles/sudoku/<date>.json for LAUNCH_DATE .. LAUNCH_DATE + SCHEDULE_DAYS - 1, and
// scripts/out/sudoku-samples.md for human review. Run with `npx tsx scripts/sudoku/generate.ts`.
//
// Difficulty by weekday (CLAUDE.md): Mon/Tue easy, Wed/Thu medium, Fri/Sat hard, Sun medium.
// Deterministic: everything flows from a single seeded Mulberry32 stream per day (base seed 11 +
// the puzzle's own date — see seedForDay in core.ts), never Math.random().
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays } from "../../src/lib/daily";
import {
  type BoardConfig,
  type Grid,
  emptyGrid,
  fillRandomSolution,
  digHoles,
  countSolutions,
  clueCount,
  mulberry32,
  seedForDay,
} from "./core";
import { gradeDifficulty, type DifficultyTier } from "./grading";

export const SUDOKU_CONFIG: BoardConfig = { size: 9, boxH: 3, boxW: 3 };
export const BASE_SEED = 11;

// Clue-count ranges a target tier digs towards, picked from the empirical sweep in RESEARCH.md
// (9x9: ~34-40 clues reliably grades easy; ~24-29 produces a real easy/medium/hard mix; ~20-23
// skews hard). The generator re-grades by technique and retries within the range rather than
// trusting clue count alone.
const CLUE_RANGE: Record<DifficultyTier, [number, number]> = {
  easy: [38, 44],
  medium: [25, 29],
  hard: [20, 23],
};

const MAX_ATTEMPTS = 60;

/** Mon/Tue easy, Wed/Thu medium, Fri/Sat hard, Sun medium — per CLAUDE.md's sudoku schedule. */
export function weekdayDifficulty(date: string): DifficultyTier {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sun .. 6 = Sat
  if (weekday === 1 || weekday === 2) return "easy";
  if (weekday === 3 || weekday === 4) return "medium";
  if (weekday === 5 || weekday === 6) return "hard";
  return "medium"; // Sunday
}

export interface GeneratedDay {
  date: string;
  puzzle: Grid;
  solution: Grid;
  difficulty: DifficultyTier;
  targetDifficulty: DifficultyTier;
  attempts: number;
}

/**
 * Generates one day's puzzle: a fresh solved grid, then repeated dig-and-grade attempts (all drawn
 * from the same per-day RNG stream, so the whole thing is reproducible from `baseSeed` + `date`)
 * until the technique grader agrees with the target tier, or `MAX_ATTEMPTS` is exhausted — in which
 * case the closest-graded attempt so far is kept (logged as suspicious in the samples file).
 */
export function generateDay(
  date: string,
  targetDifficulty: DifficultyTier,
  config: BoardConfig,
  baseSeed: number,
): GeneratedDay {
  const rng = mulberry32(seedForDay(baseSeed, date));
  const solved = emptyGrid(config);
  if (!fillRandomSolution(solved, config, rng)) {
    throw new Error(`${date}: could not fill a solved grid (should never happen on an empty grid)`);
  }

  const [min, max] = CLUE_RANGE[targetDifficulty];
  let best: { puzzle: Grid; difficulty: DifficultyTier } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const target = min + Math.floor(rng() * (max - min + 1));
    const puzzle = digHoles(solved, config, rng, target);
    if (countSolutions(puzzle, config, 2) !== 1) {
      throw new Error(`${date}: digHoles produced a puzzle without a unique solution`);
    }
    const difficulty = gradeDifficulty(puzzle, config);
    if (difficulty === targetDifficulty) {
      return { date, puzzle, solution: solved, difficulty, targetDifficulty, attempts: attempt };
    }
    if (!best) best = { puzzle, difficulty };
  }

  if (!best) throw new Error(`${date}: failed to generate any valid puzzle`);
  return {
    date,
    puzzle: best.puzzle,
    solution: solved,
    difficulty: best.difficulty,
    targetDifficulty,
    attempts: MAX_ATTEMPTS,
  };
}

/**
 * 5 sample indices spread across the schedule, nudged by up to 6 days so the samples cover a mix
 * of difficulty tiers instead of all landing on the same weekday (and therefore the same tier).
 */
function pickSampleIndices(days: GeneratedDay[]): number[] {
  const bases = [0, 1, 2, 3, 4].map((k) => Math.floor((k * days.length) / 5));
  const seenTiers = new Set<DifficultyTier>();
  return bases.map((base) => {
    let chosen = base;
    for (let offset = 0; offset < 7; offset++) {
      const candidate = Math.min(days.length - 1, base + offset);
      chosen = candidate;
      if (!seenTiers.has(days[candidate].difficulty)) break;
    }
    seenTiers.add(days[chosen].difficulty);
    return chosen;
  });
}

function renderGrid(grid: Grid, config: BoardConfig): string {
  return grid
    .map((row, r) => {
      const cells = row.map((v) => (v === 0 ? "·" : String(v))).join(" ");
      return r > 0 && r % config.boxH === 0 ? `\n${cells}` : cells;
    })
    .join("\n");
}

function main() {
  const root = resolve(import.meta.dirname, "../..");
  const contentDir = resolve(root, "content/puzzles/sudoku");
  mkdirSync(contentDir, { recursive: true });

  const days: GeneratedDay[] = [];
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const target = weekdayDifficulty(date);
    const day = generateDay(date, target, SUDOKU_CONFIG, BASE_SEED);
    days.push(day);

    const file = resolve(contentDir, `${date}.json`);
    const payload = { puzzle: day.puzzle, solution: day.solution, difficulty: day.difficulty };
    writeFileSync(file, JSON.stringify({ payload, reserve: null }));
  }

  const byTier: Record<DifficultyTier, number> = { easy: 0, medium: 0, hard: 0 };
  const mismatches = days.filter((d) => d.difficulty !== d.targetDifficulty);
  const clueCounts = days.map((d) => clueCount(d.puzzle));
  for (const d of days) byTier[d.difficulty]++;

  const sampleIndices = pickSampleIndices(days);
  const lines: string[] = [];
  lines.push("# sudoku — generated samples\n");
  lines.push(`Generated ${days.length} days from ${LAUNCH_DATE}, base seed ${BASE_SEED}.\n`);
  lines.push("## Pool stats\n");
  lines.push(`- Difficulty mix: easy ${byTier.easy}, medium ${byTier.medium}, hard ${byTier.hard}`);
  lines.push(`- Clue count: min ${Math.min(...clueCounts)}, max ${Math.max(...clueCounts)}, avg ${(clueCounts.reduce((a, b) => a + b, 0) / clueCounts.length).toFixed(1)}`);
  lines.push(`- Days where the graded difficulty didn't match the weekday target after ${MAX_ATTEMPTS} attempts (closest kept): ${mismatches.length}`);
  if (mismatches.length > 0) {
    lines.push(mismatches.slice(0, 10).map((d) => `  - ${d.date}: wanted ${d.targetDifficulty}, got ${d.difficulty}`).join("\n"));
  }
  lines.push("");

  lines.push("## Sample days\n");
  for (const i of sampleIndices) {
    const d = days[i];
    lines.push(`### #${i + 1} — ${d.date} (${d.difficulty}, ${clueCount(d.puzzle)} clues, ${d.attempts} attempt(s))\n`);
    lines.push("```");
    lines.push(renderGrid(d.puzzle, SUDOKU_CONFIG));
    lines.push("```\n");
  }

  mkdirSync(resolve(root, "scripts/out"), { recursive: true });
  writeFileSync(resolve(root, "scripts/out/sudoku-samples.md"), lines.join("\n"));
  console.log(`sudoku: wrote ${days.length} days. Difficulty mix: ${JSON.stringify(byTier)}. Mismatches: ${mismatches.length}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
