#!/usr/bin/env -S npx tsx
// Writes content/puzzles/wordle/<date>.json for LAUNCH_DATE..LAUNCH_DATE+SCHEDULE_DAYS-1, the full
// valid-guess dictionary to public/assets/wordle/guesses.json, and a human-readable sample report
// to scripts/out/wordle-samples.md. Deterministic (seed 1) and idempotent — run it again any time
// and it writes byte-for-byte the same files. Run with `npx tsx scripts/wordle/generate.ts` from
// the repo root.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { addDays, dayIndex, mulberry32, shuffle } from "../../src/lib/daily";
import { loadWordLists, buildAnswerPool, buildGuessList, COMMON_RANK_CUTOFF } from "./words";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const SEED = 1;

function main() {
  const lists = loadWordLists(ROOT);
  const pool = buildAnswerPool(lists);
  if (pool.length < SCHEDULE_DAYS) {
    throw new Error(
      `wordle generator: need ${SCHEDULE_DAYS} answers for the schedule, only found ${pool.length} ` +
        `after filtering (common rank < 15000 ∩ ENABLE, minus blocklist/plurals/past tenses).`,
    );
  }

  const answers = shuffle(pool, mulberry32(SEED)).slice(0, SCHEDULE_DAYS);
  const dupes = answers.length - new Set(answers).size;
  if (dupes > 0) throw new Error(`wordle generator: ${dupes} repeated answer(s) in the schedule.`);

  const contentDir = resolve(ROOT, "content/puzzles/wordle");
  mkdirSync(contentDir, { recursive: true });
  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(LAUNCH_DATE, i);
    const payload = { answer: answers[i].toUpperCase() };
    const file = JSON.stringify({ payload, reserve: null }, null, 2) + "\n";
    writeFileSync(resolve(contentDir, `${date}.json`), file);
  }

  const guesses = buildGuessList(lists.enable).map((w) => w.toUpperCase());
  const assetsDir = resolve(ROOT, "public/assets/wordle");
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(resolve(assetsDir, "guesses.json"), JSON.stringify(guesses) + "\n");

  writeSamples(answers, pool.length, guesses.length);

  console.log(
    `wordle: wrote ${SCHEDULE_DAYS} days (${LAUNCH_DATE} → ${addDays(LAUNCH_DATE, SCHEDULE_DAYS - 1)}), ` +
      `${guesses.length} valid guesses, answer pool ${pool.length}.`,
  );
}

function writeSamples(answers: string[], poolSize: number, guessListSize: number) {
  const sampleIndices = [0, 90, 180, 270, SCHEDULE_DAYS - 1];
  const lines: string[] = [
    "# Wordle — sample days",
    "",
    `Generated deterministically (seed ${SEED}). Re-running \`generate.ts\` reproduces this file exactly.`,
    "",
    "## Pool stats",
    "",
    `- Answer pool after filtering (common rank < ${COMMON_RANK_CUTOFF} ∩ ENABLE, minus blocklist/plurals/past tenses): **${poolSize}** words.`,
    `- Scheduled days: **${SCHEDULE_DAYS}** (needs ${SCHEDULE_DAYS}, pool has ${poolSize} — ${poolSize >= SCHEDULE_DAYS * 2 ? "comfortable" : "tight"} margin).`,
    `- Valid-guess dictionary (\`public/assets/wordle/guesses.json\`): **${guessListSize}** words.`,
    "",
    "## 5 sample days",
    "",
  ];

  for (const i of sampleIndices) {
    const date = addDays(LAUNCH_DATE, i);
    lines.push(`### Day ${i + 1} — ${date}`, "", `Answer: **${answers[i].toUpperCase()}**`, "");
  }

  lines.push(
    "## Anything suspicious?",
    "",
    "- No duplicate answers across the schedule (checked by the generator; it throws otherwise).",
    "- Every answer is a real ENABLE word within the top 15,000 most common English words, so none",
    "  should be too obscure for a friend group to solve.",
    "- Manually skim the 5 days above: none are proper nouns, abbreviations or offensive terms —",
    "  the blocklist filter already removed the ones it knows about, but it can't catch everything.",
    "",
  );

  mkdirSync(resolve(ROOT, "scripts/out"), { recursive: true });
  writeFileSync(resolve(ROOT, "scripts/out/wordle-samples.md"), lines.join("\n"));
}

main();
