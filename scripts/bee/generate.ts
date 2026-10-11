// Spelling Bee generator. See src/games/bee/RESEARCH.md for the full algorithm writeup.
//
// Pool = ENABLE1 ∩ common.txt[:40000], minus blocklist, minus any word containing "S", minus
// words shorter than 4 letters. Candidate 7-letter sets are drawn from pool words that use
// exactly 7 distinct letters (guaranteed pangrams). For each candidate set, every one of its 7
// letters is tried as the center letter; the resulting answer list is built by bitmask +
// submask enumeration over the pool, which mechanically enforces "letters subset of the 7" and
// "contains the center letter" at once. Deterministic: mulberry32(7) picks which valid puzzles
// fill the schedule and in what order.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, mulberry32, shuffle } from "../../src/lib/daily";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

export const MIN_WORD_LENGTH = 4;
export const COMMON_POOL_SIZE = 40_000;
export const MIN_ANSWERS = 20;
export const MAX_ANSWERS = 60;
export const TARGET_ANSWERS = 40;
export const GENERATOR_SEED = 7;

export interface BeePuzzle {
  center: string;
  outer: string[];
  answers: string[];
  pangrams: string[];
  maxScore: number;
}

/** 1 point for a 4-letter word, otherwise 1 point per letter, +7 for a pangram. */
export function scoreWord(word: string, fullMask: number): number {
  const base = word.length === MIN_WORD_LENGTH ? 1 : word.length;
  return base + (letterMask(word) === fullMask ? 7 : 0);
}

/** 26-bit mask, one bit per distinct letter (bit 0 = A … bit 25 = Z). */
export function letterMask(word: string): number {
  let mask = 0;
  for (const ch of word.toUpperCase()) {
    const bit = ch.charCodeAt(0) - 65;
    if (bit >= 0 && bit < 26) mask |= 1 << bit;
  }
  return mask;
}

export function popcount(mask: number): number {
  let n = mask;
  let count = 0;
  while (n) {
    n &= n - 1;
    count++;
  }
  return count;
}

export function maskToLetters(mask: number): string[] {
  const letters: string[] = [];
  for (let bit = 0; bit < 26; bit++) {
    if (mask & (1 << bit)) letters.push(String.fromCharCode(65 + bit));
  }
  return letters;
}

/** Builds a pool word → letter-mask lookup, restricted to masks with ≤7 distinct letters. */
export function buildWordsByMask(pool: readonly string[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const word of pool) {
    const mask = letterMask(word);
    if (popcount(mask) > 7) continue;
    const list = map.get(mask);
    if (list) list.push(word);
    else map.set(mask, [word]);
  }
  return map;
}

/**
 * Every submask of `freeBits` (the 6 non-center letters), each OR'd with `centerBit`, looked up
 * in `wordsByMask`. Union of hits = every pool word whose letters ⊆ the 7-letter set and that
 * contains the center letter — exactly the submask-enumeration trick the task prompt asks for.
 */
export function answersFor(
  wordsByMask: Map<number, string[]>,
  sevenLetterMask: number,
  centerBit: number,
): string[] {
  const freeBits = sevenLetterMask & ~centerBit;
  const answers: string[] = [];
  let sub = freeBits;
  // Standard "iterate all submasks of freeBits" loop, including 0; stops after wrapping past 0.
  while (true) {
    const hits = wordsByMask.get(sub | centerBit);
    if (hits) answers.push(...hits);
    if (sub === 0) break;
    sub = (sub - 1) & freeBits;
  }
  return answers;
}

export interface CandidatePuzzle {
  mask: number;
  center: number; // bit index 0-25
  answers: string[];
  pangrams: string[];
}

/** For one 7-letter mask, the best-scoring (closest-to-target answer count) valid center, if any. */
export function bestCenterFor(
  wordsByMask: Map<number, string[]>,
  mask: number,
): CandidatePuzzle | null {
  let best: CandidatePuzzle | null = null;
  let bestDistance = Infinity;
  for (let bit = 0; bit < 26; bit++) {
    const centerBit = 1 << bit;
    if (!(mask & centerBit)) continue;
    const answers = answersFor(wordsByMask, mask, centerBit);
    if (answers.length < MIN_ANSWERS || answers.length > MAX_ANSWERS) continue;
    const pangrams = answers.filter((w) => letterMask(w) === mask);
    const distance = Math.abs(answers.length - TARGET_ANSWERS);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { mask, center: bit, answers: [...answers].sort(), pangrams: [...pangrams].sort() };
    }
  }
  return best;
}

export function buildPool(
  enable1: readonly string[],
  common: readonly string[],
  blocklist: readonly string[],
): string[] {
  const commonSet = new Set(common.slice(0, COMMON_POOL_SIZE).map((w) => w.toUpperCase()));
  const blockSet = new Set(blocklist.map((w) => w.toUpperCase()));
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const raw of enable1) {
    const word = raw.toUpperCase();
    if (word.length < MIN_WORD_LENGTH) continue;
    if (word.includes("S")) continue;
    if (!commonSet.has(word)) continue;
    if (blockSet.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    pool.push(word);
  }
  return pool;
}

/** All valid (mask, center) puzzles the pool supports, one per distinct 7-letter mask. */
export function collectCandidates(wordsByMask: Map<number, string[]>): CandidatePuzzle[] {
  const candidates: CandidatePuzzle[] = [];
  for (const mask of wordsByMask.keys()) {
    if (popcount(mask) !== 7) continue;
    const best = bestCenterFor(wordsByMask, mask);
    if (best) candidates.push(best);
  }
  return candidates;
}

export function toPuzzle(candidate: CandidatePuzzle): BeePuzzle {
  const center = String.fromCharCode(65 + candidate.center);
  const outer = maskToLetters(candidate.mask & ~(1 << candidate.center));
  const maxScore = candidate.answers.reduce((sum, w) => sum + scoreWord(w, candidate.mask), 0);
  return { center, outer, answers: candidate.answers, pangrams: candidate.pangrams, maxScore };
}

function readLines(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function renderSample(date: string, puzzle: BeePuzzle): string {
  const lines = [
    `### ${date}`,
    ``,
    `Center: **${puzzle.center}** · Outer: ${puzzle.outer.join(", ")}`,
    `Max score: ${puzzle.maxScore} · Answers: ${puzzle.answers.length} · Pangrams: ${puzzle.pangrams.join(", ")}`,
    ``,
    puzzle.answers.join(", "),
    ``,
  ];
  return lines.join("\n");
}

async function main() {
  const enable1 = readLines(path.join(ROOT, "wordlists", "enable1.txt"));
  const common = readLines(path.join(ROOT, "wordlists", "common.txt"));
  const blocklist = readLines(path.join(ROOT, "wordlists", "blocklist.txt"));

  const pool = buildPool(enable1, common, blocklist);
  const wordsByMask = buildWordsByMask(pool);
  const candidates = collectCandidates(wordsByMask);

  if (candidates.length < SCHEDULE_DAYS) {
    throw new Error(
      `Only found ${candidates.length} valid puzzles, need ${SCHEDULE_DAYS}. ` +
        `Widen the pool (COMMON_POOL_SIZE) or relax MIN_ANSWERS/MAX_ANSWERS.`,
    );
  }

  const rng = mulberry32(GENERATOR_SEED);
  const shuffled = shuffle(candidates, rng);
  const scheduled = shuffled.slice(0, SCHEDULE_DAYS);

  const outDir = path.join(ROOT, "content", "puzzles", "bee");
  mkdirSync(outDir, { recursive: true });

  const puzzlesByDate: { date: string; puzzle: BeePuzzle }[] = [];
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const puzzle = toPuzzle(scheduled[i]);
    puzzlesByDate.push({ date, puzzle });
    writeFileSync(
      path.join(outDir, `${date}.json`),
      JSON.stringify({ payload: puzzle, reserve: null }, null, 2) + "\n",
    );
  }

  const sampleRng = mulberry32(GENERATOR_SEED + 1);
  const sampleIndices = shuffle(
    puzzlesByDate.map((_, i) => i),
    sampleRng,
  ).slice(0, 5);
  const counts = puzzlesByDate.map((p) => p.puzzle.answers.length);
  const maxScores = puzzlesByDate.map((p) => p.puzzle.maxScore);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const report = [
    `# Spelling Bee — generator samples`,
    ``,
    `Pool size: ${pool.length} words (ENABLE1 ∩ common top ${COMMON_POOL_SIZE}, no S, blocklist removed).`,
    `Candidate 7-letter sets with a valid center: ${candidates.length}.`,
    `Scheduled days: ${SCHEDULE_DAYS} (seed ${GENERATOR_SEED}).`,
    `Answers per puzzle: min ${Math.min(...counts)}, max ${Math.max(...counts)}, avg ${avg(counts).toFixed(1)}.`,
    `Max score per puzzle: min ${Math.min(...maxScores)}, max ${Math.max(...maxScores)}, avg ${avg(maxScores).toFixed(1)}.`,
    ``,
    `## 5 random days`,
    ``,
    ...sampleIndices.map((i) => renderSample(puzzlesByDate[i].date, puzzlesByDate[i].puzzle)),
  ].join("\n");

  mkdirSync(path.join(ROOT, "scripts", "out"), { recursive: true });
  writeFileSync(path.join(ROOT, "scripts", "out", "bee-samples.md"), report);
  console.log(`Wrote ${SCHEDULE_DAYS} puzzles to ${outDir}`);
  console.log(`Wrote scripts/out/bee-samples.md`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
