// Generates every day's Zip puzzle from LAUNCH_DATE for SCHEDULE_DAYS days.
// Deterministic: a single mulberry32(51) stream (seed 51, per the task prompt) is advanced
// sequentially across all days in date order — re-running this script reproduces byte-identical
// output. See src/games/zip/RESEARCH.md for the algorithm.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { addDays, mulberry32 } from "../../src/lib/daily";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { cellsEqual, type Cell, type Wall, type ZipPuzzle } from "../../src/games/zip/logic";
import {
  buildHamiltonianPath,
  findSolutions,
  growCheckpoints,
  pickDifferingEdge,
  selectCheckpoints,
} from "./hamiltonian";

const SEED = 51;

/** 6×6 Mon–Wed, 7×7 Thu–Sat, 8×8 Sun (per CLAUDE.md's size-by-weekday rule). */
function sizeForDate(date: string): number {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  if (weekday === 0) return 8;
  if (weekday >= 1 && weekday <= 3) return 6;
  return 7; // 4,5,6 = Thu,Fri,Sat
}

function baselineCheckpoints(size: number): number {
  return size - 1; // roughly one per row, matching the real game's density
}

function hardCheckpointCeiling(size: number): number {
  return Math.floor((size * size) / 2);
}

// A modest allowance of extra checkpoints (beyond the baseline) to try *before* reaching for a
// wall each round. Pure wall-first (see git history) measured 6-13 walls on average, with the
// generator's own samples report flagging most days as visually cluttered. Spending a few extra
// checkpoints first — still far short of hardCheckpointCeiling — buys down the wall count without
// re-creating the "15-20 of 36 cells numbered" problem RESEARCH.md measured for checkpoints-first.
function softCheckpointAllowance(size: number): number {
  // Larger grids have far more alternate Hamiltonian paths (the search space grows much faster
  // than linearly), so they need a bigger allowance to keep walls down to the same rough level.
  return size <= 6 ? 3 : size === 7 ? 6 : 10;
}

// A safety valve, not a target: the witness-driven wall (see generateDay's docstring) is always
// tried first and almost always resolves it well under this. Measured runs stayed in single
// digits to low teens of walls with checkpoints pinned at the baseline; see RESEARCH.md.
const WALL_CAP = 20;
const SOLVER_CAP = 2;
const SOLVER_NODE_BUDGET = 400_000;
const MAX_PATH_ATTEMPTS = 25;
const MAX_GROWTH_ROUNDS = 60;

export interface GeneratedDay {
  date: string;
  puzzle: ZipPuzzle;
}

function pathsEqual(a: Cell[], b: Cell[]): boolean {
  return a.length === b.length && a.every((cell, i) => cellsEqual(cell, b[i]));
}

/**
 * Builds one day's unique-solution puzzle: random Hamiltonian path, then "add constraints until
 * there is exactly one solution" — the uniqueness-by-search technique from RESEARCH.md ("Puzzle
 * Madness's Numberlink generator write-up" / Rikudo's SAT-based approach): run the solver, and
 * whenever it turns up an alternate solution, wall off one specific edge that alternate relies on
 * (and the true path doesn't), which eliminates it without ever risking the true path. Only when
 * no such edge is left to try (the wall budget's spent, or the search can't tell yet) does it fall
 * back to adding another checkpoint instead.
 */
export function generateDay(rng: () => number, size: number): ZipPuzzle {
  for (let pathAttempt = 0; pathAttempt < MAX_PATH_ATTEMPTS; pathAttempt++) {
    const path = buildHamiltonianPath(rng, size);
    if (!path) continue;

    let walls: Wall[] = [];
    let checkpointCount = baselineCheckpoints(size);
    let checkpoints = selectCheckpoints(path, checkpointCount, rng);

    for (let round = 0; round < MAX_GROWTH_ROUNDS; round++) {
      const { solutions, budgetExceeded } = findSolutions(
        size,
        checkpoints,
        walls,
        SOLVER_CAP,
        SOLVER_NODE_BUDGET,
      );
      if (solutions.length === 1 && !budgetExceeded) {
        return { size, checkpoints, walls, solution: path };
      }
      if (budgetExceeded) break; // too expensive to resolve on this path — try a fresh one

      const alt = solutions.find((s) => !pathsEqual(s, path));
      const softCap = baselineCheckpoints(size) + softCheckpointAllowance(size);
      const tryGrow = (ceiling: number): boolean => {
        if (checkpointCount >= ceiling) return false;
        const grown = growCheckpoints(path, checkpoints);
        if (grown.length <= checkpoints.length) return false;
        checkpointCount++;
        checkpoints = grown;
        return true;
      };

      // Spend the modest checkpoint allowance first — cheaper visually than a wall, and it never
      // runs away to the checkpoints-first problem RESEARCH.md measured, because it's capped low.
      if (tryGrow(softCap)) continue;

      const wall = alt && walls.length < WALL_CAP ? pickDifferingEdge(alt, path, walls) : null;
      if (wall) {
        walls = [...walls, wall];
        continue;
      }

      if (tryGrow(hardCheckpointCeiling(size))) continue;
      break; // nothing left to try against this path — give up, try a new one
    }
  }
  throw new Error(`zip: could not find a unique-solution ${size}x${size} puzzle in time`);
}

async function main() {
  const rng = mulberry32(SEED);
  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../content/puzzles/zip");
  await mkdir(outDir, { recursive: true });

  const days: GeneratedDay[] = [];
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const size = sizeForDate(date);
    const puzzle = generateDay(rng, size);
    days.push({ date, puzzle });

    const file = resolve(outDir, `${date}.json`);
    const content = { payload: puzzle, reserve: null };
    await writeFile(file, JSON.stringify(content, null, 2) + "\n", "utf8");
  }

  console.log(`zip: wrote ${days.length} day files to ${outDir}`);
  await writeSamples(days);
}

function renderGrid(puzzle: ZipPuzzle): string {
  const numberAt = new Map<string, number>();
  for (const cp of puzzle.checkpoints) numberAt.set(`${cp.row},${cp.col}`, cp.num);

  const lines: string[] = [];
  for (let r = 0; r < puzzle.size; r++) {
    let rowCells = "";
    for (let c = 0; c < puzzle.size; c++) {
      const label = numberAt.get(`${r},${c}`);
      rowCells += (label !== undefined ? String(label).padStart(2, " ") : " ·") + " ";
      if (c < puzzle.size - 1) {
        rowCells += puzzle.walls.some(
          (w) =>
            (w.a.row === r && w.a.col === c && w.b.row === r && w.b.col === c + 1) ||
            (w.b.row === r && w.b.col === c && w.a.row === r && w.a.col === c + 1),
        )
          ? "┃"
          : " ";
      }
    }
    lines.push(rowCells);
    if (r < puzzle.size - 1) {
      let between = "";
      for (let c = 0; c < puzzle.size; c++) {
        between +=
          (puzzle.walls.some(
            (w) =>
              (w.a.row === r && w.a.col === c && w.b.row === r + 1 && w.b.col === c) ||
              (w.b.row === r && w.b.col === c && w.a.row === r + 1 && w.a.col === c),
          )
            ? "━━"
            : "  ") + "  ";
      }
      lines.push(between);
    }
  }
  return lines.join("\n");
}

async function writeSamples(days: GeneratedDay[]) {
  const bySize = new Map<number, GeneratedDay[]>();
  for (const d of days) {
    const arr = bySize.get(d.puzzle.size) ?? [];
    arr.push(d);
    bySize.set(d.puzzle.size, arr);
  }

  const sampleRng = mulberry32(SEED + 1);
  const sampleCount = Math.min(5, days.length);
  const sampleIndices = new Set<number>();
  while (sampleIndices.size < sampleCount) {
    sampleIndices.add(Math.floor(sampleRng() * days.length));
  }

  const lines: string[] = ["# Zip — generated sample days", ""];

  lines.push("## Pool stats", "");
  lines.push(`Total days generated: ${days.length}`, "");
  lines.push("| Size | Count | Avg checkpoints | Avg walls | Min checkpoints | Max checkpoints |");
  lines.push("|---|---|---|---|---|---|");
  for (const [size, arr] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) {
    const checkpointCounts = arr.map((d) => d.puzzle.checkpoints.length);
    const wallCounts = arr.map((d) => d.puzzle.walls.length);
    const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
    lines.push(
      `| ${size}×${size} | ${arr.length} | ${avg(checkpointCounts)} | ${avg(wallCounts)} | ${Math.min(...checkpointCounts)} | ${Math.max(...checkpointCounts)} |`,
    );
  }
  lines.push("");

  const withWalls = days.filter((d) => d.puzzle.walls.length > 0).length;
  lines.push(
    `Days with at least one wall: ${withWalls}/${days.length} (${((withWalls / days.length) * 100).toFixed(0)}%)`,
    "",
  );

  lines.push("## Sample days", "");
  for (const i of [...sampleIndices].sort((a, b) => a - b)) {
    const { date, puzzle } = days[i];
    lines.push(`### ${date} — ${puzzle.size}×${puzzle.size}, ${puzzle.checkpoints.length} checkpoints, ${puzzle.walls.length} walls`, "");
    lines.push("```");
    lines.push(renderGrid(puzzle));
    lines.push("```", "");
  }

  lines.push("## Anything suspicious?", "");
  const singleCheckpointDays = days.filter((d) => d.puzzle.checkpoints.length <= 2);
  const heavyWallDays = days.filter((d) => d.puzzle.walls.length > 6);
  if (singleCheckpointDays.length) {
    lines.push(
      `- ${singleCheckpointDays.length} day(s) resolved with only the start/end checkpoints (no interior numbers) — double check these aren't too hard: ${singleCheckpointDays
        .slice(0, 10)
        .map((d) => d.date)
        .join(", ")}`,
    );
  } else {
    lines.push("- Every day has at least one interior checkpoint beyond start/end.");
  }
  if (heavyWallDays.length) {
    lines.push(
      `- ${heavyWallDays.length} day(s) needed more than 6 walls to force uniqueness — may look cluttered: ${heavyWallDays
        .slice(0, 10)
        .map((d) => d.date)
        .join(", ")}`,
    );
  } else {
    lines.push("- No day needed more than 6 walls.");
  }

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../out/zip-samples.md");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`zip: wrote ${outPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
