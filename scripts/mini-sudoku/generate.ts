#!/usr/bin/env tsx
// Writes content/puzzles/mini-sudoku/<date>.json for the full schedule, and
// scripts/out/mini-sudoku-samples.md for human review. Run with
// `npx tsx scripts/mini-sudoku/generate.ts`. Shares its generation engine with sudoku (see
// ../sudoku/core.ts, ../sudoku/grading.ts) — this file only differs in board size, base seed,
// weekday mapping and clue-count bands.
//
// Difficulty by weekday (CLAUDE.md): easy Mon-Thu, medium Fri-Sun. Mini sudoku only ever has two
// tiers (no "hard" day).
//
// RESEARCH.md "Chosen design" explains why mini's acceptance rule differs from sudoku's: at every
// clue count down to the practical minimum for a 6x6/2x3 grid, the technique grader almost always
// still reports "easy" (6x6 is small enough that naked/hidden singles cascade through nearly any
// unique puzzle — confirmed empirically before writing this). So difficulty here is driven by the
// clue-count band itself (fewer givens = more cells to work out = a longer, harder-feeling solve),
// and the grader is only used as a floor check: a puzzle that would need real backtracking (graded
// "hard") is never shipped for mini, so a day always retries rather than asking a kid-friendly game
// to make an unverifiable guess.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
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
} from "../sudoku/core";
import { gradeDifficulty, type DifficultyTier } from "../sudoku/grading";

export const MINI_CONFIG: BoardConfig = { size: 6, boxH: 2, boxW: 3 };
export const BASE_SEED = 12;

export type MiniDifficultyTier = "easy" | "medium";

const CLUE_RANGE: Record<MiniDifficultyTier, [number, number]> = {
  easy: [16, 20],
  medium: [9, 12],
};

const MAX_ATTEMPTS = 60;

/** Easy Mon-Thu, medium Fri-Sun — per CLAUDE.md's mini-sudoku schedule. */
export function weekdayDifficulty(date: string): MiniDifficultyTier {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sun .. 6 = Sat
  return weekday === 5 || weekday === 6 || weekday === 0 ? "medium" : "easy";
}

export interface GeneratedDay {
  date: string;
  puzzle: Grid;
  solution: Grid;
  difficulty: MiniDifficultyTier;
  attempts: number;
}

/**
 * Digs towards a clue count in the target tier's band, accepting any result the technique grader
 * doesn't flag as "hard" (needs backtracking) — see the file header for why mini doesn't require an
 * exact tier match the way sudoku does.
 */
export function generateDay(
  date: string,
  targetDifficulty: MiniDifficultyTier,
  config: BoardConfig,
  baseSeed: number,
): GeneratedDay {
  const rng = mulberry32(seedForDay(baseSeed, date));
  const solved = emptyGrid(config);
  if (!fillRandomSolution(solved, config, rng)) {
    throw new Error(`${date}: could not fill a solved grid (should never happen on an empty grid)`);
  }

  const [min, max] = CLUE_RANGE[targetDifficulty];
  let best: Grid | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const target = min + Math.floor(rng() * (max - min + 1));
    const puzzle = digHoles(solved, config, rng, target);
    if (countSolutions(puzzle, config, 2) !== 1) {
      throw new Error(`${date}: digHoles produced a puzzle without a unique solution`);
    }
    const grade = gradeDifficulty(puzzle, config);
    if (grade !== "hard") {
      return { date, puzzle, solution: solved, difficulty: targetDifficulty, attempts: attempt };
    }
    if (!best) best = puzzle;
  }

  if (!best) throw new Error(`${date}: failed to generate any valid puzzle`);
  return { date, puzzle: best, solution: solved, difficulty: targetDifficulty, attempts: MAX_ATTEMPTS };
}

function renderGrid(grid: Grid, config: BoardConfig): string {
  return grid
    .map((row, r) => {
      const cells = row.map((v) => (v === 0 ? "·" : String(v))).join(" ");
      return r > 0 && r % config.boxH === 0 ? `\n${cells}` : cells;
    })
    .join("\n");
}

function pickSampleIndices(days: GeneratedDay[]): number[] {
  const bases = [0, 1, 2, 3, 4].map((k) => Math.floor((k * days.length) / 5));
  const seenTiers = new Set<MiniDifficultyTier>();
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

function main() {
  const root = resolve(import.meta.dirname, "../..");
  const contentDir = resolve(root, "content/puzzles/mini-sudoku");
  mkdirSync(contentDir, { recursive: true });

  const days: GeneratedDay[] = [];
  let hardRejections = 0;
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const target = weekdayDifficulty(date);
    const day = generateDay(date, target, MINI_CONFIG, BASE_SEED);
    if (day.attempts > 1) hardRejections++;
    days.push(day);

    const file = resolve(contentDir, `${date}.json`);
    const payload = { puzzle: day.puzzle, solution: day.solution, difficulty: day.difficulty };
    writeFileSync(file, JSON.stringify({ payload, reserve: null }));
  }

  const byTier: Record<MiniDifficultyTier, number> = { easy: 0, medium: 0 };
  const clueCounts = days.map((d) => clueCount(d.puzzle));
  for (const d of days) byTier[d.difficulty]++;

  const sampleIndices = pickSampleIndices(days);
  const lines: string[] = [];
  lines.push("# mini-sudoku — generated samples\n");
  lines.push(`Generated ${days.length} days from ${LAUNCH_DATE}, base seed ${BASE_SEED}.\n`);
  lines.push("## Pool stats\n");
  lines.push(`- Difficulty mix: easy ${byTier.easy}, medium ${byTier.medium}`);
  lines.push(`- Clue count: min ${Math.min(...clueCounts)}, max ${Math.max(...clueCounts)}, avg ${(clueCounts.reduce((a, b) => a + b, 0) / clueCounts.length).toFixed(1)}`);
  lines.push(`- Days where a dig attempt graded "hard" and had to retry: ${hardRejections}`);
  lines.push(
    `- Note: the technique grader found almost every 6x6/2x3 puzzle solvable with singles alone, even near the clue-count floor — see RESEARCH.md. Difficulty here comes from the clue-count band (fewer givens), not from needing fundamentally different techniques.`,
  );
  lines.push("");

  lines.push("## Sample days\n");
  for (const i of sampleIndices) {
    const d = days[i];
    lines.push(`### #${i + 1} — ${d.date} (${d.difficulty}, ${clueCount(d.puzzle)} clues, ${d.attempts} attempt(s))\n`);
    lines.push("```");
    lines.push(renderGrid(d.puzzle, MINI_CONFIG));
    lines.push("```\n");
  }

  mkdirSync(resolve(root, "scripts/out"), { recursive: true });
  writeFileSync(resolve(root, "scripts/out/mini-sudoku-samples.md"), lines.join("\n"));
  console.log(`mini-sudoku: wrote ${days.length} days. Difficulty mix: ${JSON.stringify(byTier)}. Hard rejections: ${hardRejections}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
