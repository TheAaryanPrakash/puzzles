#!/usr/bin/env node
// Usage: pnpm shot <url> <out.png> [width]
// Headless screenshot via the Playwright Chromium installed in foundation's `pnpm exec
// playwright install chromium` (shared cache, so every worktree can use it without reinstalling).
import { chromium } from "playwright";

const [, , url, out, widthArg] = process.argv;
if (!url || !out) {
  console.error("Usage: pnpm shot <url> <out.png> [width]");
  process.exit(1);
}

const width = widthArg ? Number(widthArg) : 1280;
const height = width <= 480 ? 844 : 800;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: out, fullPage: true });
  console.log(`Saved ${out} (${width}x${height})`);
} finally {
  await browser.close();
}
