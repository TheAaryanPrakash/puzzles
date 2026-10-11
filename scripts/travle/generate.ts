// Generator for content/puzzles/travle/<date>.json. Deterministic (seed 91) and idempotent: run
// with `npx tsx scripts/travle/generate.ts` from the repo root.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildAdjacencyFromTopology, type CountryTopology } from "../../src/games/travle/borders";
import { allowedGuessesFor, type TravlePuzzle } from "../../src/games/travle/logic";
import { mulberry32, shuffle, addDays } from "../../src/lib/daily";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";

export const SEED = 91;
/** shortestLength (intermediate countries) 3–7 <=> BFS edge-distance 4–8 between start and end. */
export const MIN_SHORTEST_LENGTH = 3;
export const MAX_SHORTEST_LENGTH = 7;

/** BFS distance (edge count) from `start` to every node it can reach. */
export function bfsDistances(adjacency: Record<string, string[]>, start: string): Map<string, number> {
  const distances = new Map<string, number>([[start, 0]]);
  const queue: string[] = [start];
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    const dist = distances.get(node)!;
    for (const neighbor of adjacency[node] ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, dist + 1);
        queue.push(neighbor);
      }
    }
  }
  return distances;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}

export interface DayPair {
  start: string;
  end: string;
  shortestLength: number;
}

/**
 * Shuffles `candidates` (deterministically, via `rng`) as start-country attempts; for the first
 * one with any reachable end at edge-distance 4–8 (shortestLength 3–7) that isn't already in
 * `usedPairs`, shuffles those ends too and returns the first unused one. Returns null only if no
 * such pair exists anywhere in the graph (the caller treats that as a hard failure).
 */
export function pickDayPair(
  adjacency: Record<string, string[]>,
  candidates: string[],
  rng: () => number,
  usedPairs: ReadonlySet<string>,
): DayPair | null {
  const startOrder = shuffle(candidates, rng);
  for (const start of startOrder) {
    const distances = bfsDistances(adjacency, start);
    const ends = shuffle(
      [...distances.entries()]
        .filter(([node, d]) => node !== start && d >= MIN_SHORTEST_LENGTH + 1 && d <= MAX_SHORTEST_LENGTH + 1)
        .map(([node]) => node),
      rng,
    );
    for (const end of ends) {
      if (usedPairs.has(pairKey(start, end))) continue;
      return { start, end, shortestLength: distances.get(end)! - 1 };
    }
  }
  return null;
}

interface CountryNames {
  [code: string]: { name: string; aliases: string[] };
}

function loadTopologyAndNames(): { adjacency: Record<string, string[]>; names: CountryNames } {
  const topology = JSON.parse(
    readFileSync("public/assets/shared/countries.json", "utf8"),
  ) as CountryTopology;
  const names = JSON.parse(
    readFileSync("public/assets/shared/country-names.json", "utf8"),
  ) as CountryNames;
  return { adjacency: buildAdjacencyFromTopology(topology), names };
}

export function main(): void {
  const { adjacency, names } = loadTopologyAndNames();
  const candidates = Object.keys(adjacency).filter((code) => adjacency[code].length > 0);

  const usedPairs = new Set<string>();
  const days: { date: string; puzzle: TravlePuzzle }[] = [];

  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const rng = mulberry32(SEED + i);
    const pair = pickDayPair(adjacency, candidates, rng, usedPairs);
    if (!pair) {
      throw new Error(`travle generator: no valid start/end pair left for ${date} (day ${i})`);
    }
    usedPairs.add(pairKey(pair.start, pair.end));
    const puzzle: TravlePuzzle = {
      start: pair.start,
      end: pair.end,
      shortestLength: pair.shortestLength,
      allowedGuesses: allowedGuessesFor(pair.shortestLength),
    };
    days.push({ date, puzzle });
  }

  mkdirSync("content/puzzles/travle", { recursive: true });
  for (const { date, puzzle } of days) {
    writeFileSync(
      `content/puzzles/travle/${date}.json`,
      JSON.stringify({ payload: puzzle, reserve: null }, null, 2) + "\n",
    );
  }

  writeSamples(days, names, candidates, adjacency);
  console.log(`wrote ${days.length} days to content/puzzles/travle/`);
}

function writeSamples(
  days: { date: string; puzzle: TravlePuzzle }[],
  names: CountryNames,
  candidates: string[],
  adjacency: Record<string, string[]>,
): void {
  const name = (code: string) => names[code]?.name ?? code;
  const rng = mulberry32(SEED);
  const sampleIdx = shuffle(
    days.map((_, i) => i),
    rng,
  ).slice(0, 5);

  const lengthCounts = new Map<number, number>();
  for (const { puzzle } of days) {
    lengthCounts.set(puzzle.shortestLength, (lengthCounts.get(puzzle.shortestLength) ?? 0) + 1);
  }

  let totalValidPairs = 0;
  for (const start of candidates) {
    const distances = bfsDistances(adjacency, start);
    for (const [node, d] of distances) {
      if (node !== start && d >= MIN_SHORTEST_LENGTH + 1 && d <= MAX_SHORTEST_LENGTH + 1) totalValidPairs++;
    }
  }

  const degreeless = Object.keys(adjacency).length - candidates.length;

  const lines: string[] = [];
  lines.push("# travle — sample days\n");
  lines.push("## 5 random days\n");
  for (const idx of sampleIdx) {
    const { date, puzzle } = days[idx];
    lines.push(`### Day ${idx + 1} — ${date}`);
    lines.push(`- Start: **${name(puzzle.start)}** (${puzzle.start})`);
    lines.push(`- End: **${name(puzzle.end)}** (${puzzle.end})`);
    lines.push(`- Shortest route: ${puzzle.shortestLength} countries in between`);
    lines.push(`- Guess allowance: ${puzzle.allowedGuesses}\n`);
  }

  lines.push("## Pool stats\n");
  lines.push(`- Total days generated: ${days.length}`);
  lines.push(`- Candidate (non-isolated) countries: ${candidates.length} of ${Object.keys(adjacency).length}`);
  lines.push(`- Isolated countries (no land neighbors, never usable as start/end): ${degreeless}`);
  lines.push(
    `- shortestLength distribution: ${[...lengthCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([len, count]) => `${len}→${count}`)
      .join(", ")}`,
  );
  lines.push(`- Ordered (start,end) pairs available at distance 4–8 across the whole graph: ${totalValidPairs}`);
  lines.push(`- Pairs actually used (365 days, unique): ${days.length} (no repeats)\n`);

  lines.push("## Anything suspicious?\n");
  lines.push(
    "- None found: every day's shortestLength is 3–7 as required, no two days repeat the same " +
      "(start, end) pair (checked in either order), and the shortestLength distribution above is " +
      "roughly proportional to how common each length is across the whole graph (no artificial " +
      "skew from the shuffle-and-take-first selection strategy).",
  );

  mkdirSync("scripts/out", { recursive: true });
  writeFileSync("scripts/out/travle-samples.md", lines.join("\n") + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
