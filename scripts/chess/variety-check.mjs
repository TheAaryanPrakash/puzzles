#!/usr/bin/env node
// Usage: PORT=5215 pnpm dev (in one terminal), then: node scripts/chess/variety-check.mjs [baseUrl]
//
// Proves RESEARCH.md §5's move-variety claim: 8 fresh Hard games where the player plays the same
// first 3 moves should produce at least 4 different resulting lines (the engine's own replies
// shouldn't be deterministic). Three White developing moves (e4, Nf3, Nc3) are used because
// they're legal regardless of how the engine (Black) replies, so this never fails on illegality —
// only on an actual lack of variety.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.argv[2] || "http://localhost:5215";
const GAMES = 8;
const MIN_DISTINCT = 4;
const SCRIPTED_MOVES = [
  ["e2", "e4"],
  ["g1", "f3"],
  ["b1", "c3"],
];

async function playOneLine(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${BASE}/chess`, { waitUntil: "networkidle" });
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.getByRole("radio", { name: "Hard" }).click();
    await page.getByRole("radio", { name: "White", exact: true }).click();
    await page.getByRole("radio", { name: "Off" }).click();
    await page.getByRole("button", { name: "Start game" }).click();
    await page.waitForSelector('[role="grid"]', { timeout: 5000 });

    for (const [from, to] of SCRIPTED_MOVES) {
      await page.click(`[data-square="${from}"]`);
      await page.click(`[data-square="${to}"]`);
      // Hard's movetime is up to 1200ms; give it real margin on a possibly-loaded machine.
      await page.waitForTimeout(2000);
    }

    const line = await page.locator('[aria-label="Move list"]').innerText();
    return line.replace(/\s+/g, " ").trim();
  } finally {
    await page.close();
  }
}

console.log(`Running ${GAMES} Hard games against ${BASE}, same first 3 moves each...`);
const browser = await chromium.launch();
const lines = [];
try {
  for (let i = 0; i < GAMES; i++) {
    const line = await playOneLine(browser);
    lines.push(line);
    console.log(`  game ${i + 1}: ${line}`);
  }
} finally {
  await browser.close();
}

const distinct = new Set(lines);
console.log(`\n${distinct.size} distinct line(s) out of ${GAMES} games.`);
assert.ok(
  distinct.size >= MIN_DISTINCT,
  `expected at least ${MIN_DISTINCT} distinct engine lines, got ${distinct.size}: ${JSON.stringify([...distinct])}`,
);
console.log(`PASS: ${distinct.size} >= ${MIN_DISTINCT} distinct lines.`);
