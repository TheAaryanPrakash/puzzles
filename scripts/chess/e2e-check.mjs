#!/usr/bin/env node
// Usage: PORT=5215 pnpm dev (in one terminal), then: node scripts/chess/e2e-check.mjs [baseUrl]
//
// No @playwright/test runner exists in this repo (only the raw `playwright` library, used the
// same way scripts/shot.mjs already does) — see RESEARCH.md's "Chosen design" for why this is a
// plain Node script instead. Drives a real browser against a real dev server and asserts on what
// it sees; throws (non-zero exit) on any failure so it can be rerun as a regression check.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.argv[2] || "http://localhost:5215";

async function withPage(fn) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    await fn(page);
    assert.deepEqual(consoleErrors, [], `console errors: ${JSON.stringify(consoleErrors)}`);
  } finally {
    await browser.close();
  }
}

async function startGame(page, { difficulty = "Easy", side = "White", clock = "Off" } = {}) {
  await page.goto(`${BASE}/chess`, { waitUntil: "networkidle" });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.getByRole("radio", { name: difficulty }).click();
  await page.getByRole("radio", { name: side, exact: true }).click();
  await page.getByRole("radio", { name: clock }).click();
  await page.getByRole("button", { name: "Start game" }).click();
  await page.waitForSelector('[role="grid"]', { timeout: 5000 });
}

async function clickSquare(page, square) {
  await page.click(`[data-square="${square}"]`);
}

console.log(`Running chess e2e checks against ${BASE} ...`);

await withPage(async (page) => {
  await startGame(page, { difficulty: "Easy", side: "White", clock: "Off" });
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  await page.waitForTimeout(1200);
  // The move list renders as a CSS grid, so innerText puts each cell on its own line — check
  // tokens are present rather than assuming a single-line "1. e4 e5" layout.
  const tokens = (await page.locator('[aria-label="Move list"]').innerText()).split("\n").map((s) => s.trim());
  assert.ok(tokens.includes("e4"), `player's e4 should appear in the move list, got: ${JSON.stringify(tokens)}`);
  assert.ok(tokens.length >= 3, `the engine should have replied by now, got: ${JSON.stringify(tokens)}`);
  console.log("✓ play as White: board renders, move applies, engine replies");
});

await withPage(async (page) => {
  await startGame(page, { difficulty: "Easy", side: "Black", clock: "Off" });
  await page.waitForTimeout(1200); // engine (White) should move first, unprompted
  const moveList = await page.locator('[aria-label="Move list"]').innerText();
  assert.ok(moveList.trim().length > 0, "the engine should have moved first as White");
  const boardBox = await page.locator('[role="grid"]').boundingBox();
  const a8 = await page.locator('[data-square="a8"]').boundingBox();
  const a1 = await page.locator('[data-square="a1"]').boundingBox();
  assert.ok(a8.y < a1.y === false || a1.y < a8.y, "sanity: a1 should render below a8 when flipped too");
  // Flipped board: h1 (White's own rook corner) should render top-left-ish when playing Black —
  // concretely, a1's row should be ABOVE a8's row when NOT flipped, and the reverse when flipped.
  assert.ok(a1.y < a8.y, "a1 should be above a8 — playing Black flips the board (rank 8 at the bottom)");
  console.log("✓ play as Black: board is flipped, engine moves first");
});

await withPage(async (page) => {
  await startGame(page, { difficulty: "Easy", side: "White", clock: "Off" });
  await clickSquare(page, "d2");
  await clickSquare(page, "d4");
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[role="grid"]', { timeout: 5000 });
  const moveList = await page.locator('[aria-label="Move list"]').innerText();
  assert.match(moveList, /d4/, "a refresh mid-game should restore the position exactly");
  console.log("✓ refresh mid-game restores the game");
});

await withPage(async (page) => {
  await startGame(page, { difficulty: "Easy", side: "White", clock: "Off" });
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Hint" }).click();
  await page.waitForTimeout(1500);
  const hinted = await page.locator('[data-hint="true"]').count();
  assert.ok(hinted >= 2, "a hint should highlight a from/to square pair");
  console.log("✓ hint highlights a candidate move");

  await page.getByRole("button", { name: "Undo" }).click();
  // Exactly one round (e2e4 + the engine's reply) was played, so undoing it returns to the
  // empty-board message rather than a populated move list.
  await page.waitForSelector("text=No moves yet.", { timeout: 5000 });
  console.log("✓ undo pops the round off the move list");
});

console.log("All chess e2e checks passed.");
