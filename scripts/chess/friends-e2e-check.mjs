#!/usr/bin/env node
// Usage: PORT=5215 pnpm dev (with VITE_DATA_SOURCE unset/local), then:
//   node scripts/chess/friends-e2e-check.mjs [baseUrl]
//
// Same approach as scripts/chess/e2e-check.mjs (plain Node + the raw `playwright` library, no
// @playwright/test runner in this repo). Two pages in one browser context: localStorage (the
// local adapter's chess rows) is shared between them, same as it would be across two real tabs on
// one device, while sessionStorage (the dev-only ?devUser=/?devAuth= overrides) stays per-page —
// exactly what lets one context act as two different members.
//
// Scope: link creation, the signed-out-to-sign-in-and-back round trip (via ?devAuth=signed-out),
// cross-tab accept, a full scripted game to checkmate with the result showing live on both pages,
// and a reload mid-game restoring exactly. "A stale tab can't move" is proven at the unit level
// instead (src/lib/data/chess.test.ts's local-adapter expectedPly cases and
// supabase/tests/schema.test.mjs's make_move cases) — simulating genuine staleness against a
// same-context BroadcastChannel, which propagates near-instantly, would need artificially
// suppressing delivery to one page, which isn't worth the fragility here.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.argv[2] || "http://localhost:5215";

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  context.on("page", (page) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[${page.url()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`[${page.url()}] ${err}`));
  });

  try {
    const sansita = await context.newPage();
    await sansita.goto(`${BASE}/chess?tab=friends`, { waitUntil: "networkidle" });

    await sansita.getByRole("button", { name: "New challenge" }).first().click();
    await sansita.getByRole("button", { name: "White", exact: true }).click();
    await sansita.getByRole("button", { name: "Make a link instead" }).click();
    const linkText = await sansita.locator("p.break-all").innerText();
    const token = new URL(linkText).searchParams.get("challenge");
    assert.ok(token, `expected a challenge token in the created link, got: ${linkText}`);
    console.log("✓ link challenge created");

    // The sign-in round trip: ?devAuth=signed-out forces RequireMember's /signin redirect locally.
    const riya = await context.newPage();
    await riya.goto(`${BASE}/chess?devUser=riya&devAuth=signed-out&challenge=${encodeURIComponent(token)}`, {
      waitUntil: "networkidle",
    });
    await riya.waitForURL(/\/signin/, { timeout: 5000 });
    await riya.getByRole("button", { name: /Continue with Google/ }).click();
    await riya.waitForURL(/\/chess/, { timeout: 5000 });
    console.log("✓ signed-out visitor round-trips through /signin back to the same challenge");

    await riya.getByRole("button", { name: "Accept" }).click();
    await riya.waitForSelector('[role="grid"]', { timeout: 5000 });
    console.log("✓ cross-tab accept creates and opens the game");

    // Sansita's page has no live subscription to "a challenge of mine got accepted" — same as a
    // real second device, she only sees the new game after revisiting her own games list.
    await sansita.goto(`${BASE}/chess?tab=friends`, { waitUntil: "networkidle" });
    await sansita.getByText(/vs Riya/).click();
    // Sansita picked White, so Sansita is White, Riya is Black — a fixed, known orientation lets
    // this script play a deterministic scholar's-mate-style forced sequence.
    await sansita.waitForSelector('[role="grid"]', { timeout: 5000 });

    async function move(page, from, to) {
      await page.click(`[data-square="${from}"]`);
      await page.click(`[data-square="${to}"]`);
      await page.waitForTimeout(400); // local adapter write + BroadcastChannel round trip
    }

    // Fool's mate: fastest forced mate, White loses — exercises the full lose/win path on both
    // sides rather than always proving the challenger wins.
    await move(sansita, "f2", "f3");
    await move(riya, "e7", "e5");
    await move(sansita, "g2", "g4");
    await move(riya, "d8", "h4");

    await sansita.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await riya.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const sansitaResult = await sansita.locator('[role="dialog"] h2').innerText();
    const riyaResult = await riya.locator('[role="dialog"] h2').innerText();
    assert.equal(sansitaResult, "Next time", `White should see a loss, got: ${sansitaResult}`);
    assert.equal(riyaResult, "You won!", `Black should see a win, got: ${riyaResult}`);
    console.log("✓ checkmate shows live on both pages, correct result each side");

    // Reload mid-"finished" game restores exactly (same assertion the computer-mode e2e check
    // makes for an in-progress game — here the game is already over, which exercises the same
    // fetch-on-mount path with a frozen row).
    await riya.reload({ waitUntil: "networkidle" });
    await riya.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const riyaResultAfterReload = await riya.locator('[role="dialog"] h2').innerText();
    assert.equal(riyaResultAfterReload, "You won!", "result should survive a reload");
    console.log("✓ reload mid/post-game restores exactly");

    assert.deepEqual(errors, [], `console errors across both pages: ${JSON.stringify(errors, null, 2)}`);
    console.log("\nAll friends-mode e2e checks passed.");
  } finally {
    await browser.close();
  }
}

await run();
