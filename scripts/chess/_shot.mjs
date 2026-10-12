// One-off helper for capturing RESEARCH.md/HANDOFF.md's required screenshots (375px + 1280px).
// Not part of the test suite — run manually: node scripts/chess/_shot.mjs [baseUrl]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] || "http://localhost:5215";
const OUT = fileURLToPath(new URL("../../src/games/chess/screenshots/", import.meta.url));

const browser = await chromium.launch();

async function shot(width, height, name, setup) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${BASE}/chess`, { waitUntil: "networkidle" });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await setup(page);
  await page.screenshot({ path: OUT + name, fullPage: true });
  await page.close();
  console.log(`Saved ${name}`);
}

await shot(375, 700, "mobile-375-settings.png", async () => {});

await shot(375, 844, "mobile-375-board.png", async (page) => {
  await page.getByRole("radio", { name: "Medium" }).click();
  await page.getByRole("radio", { name: "White", exact: true }).click();
  await page.getByRole("radio", { name: "Off" }).click();
  await page.getByRole("button", { name: "Start game" }).click();
  await page.waitForSelector('[role="grid"]', { timeout: 5000 });
  await page.click('[data-square="e2"]');
  await page.click('[data-square="e4"]');
  await page.waitForTimeout(1500);
});

await shot(1280, 900, "desktop-1280-board.png", async (page) => {
  await page.getByRole("radio", { name: "Medium" }).click();
  await page.getByRole("radio", { name: "White", exact: true }).click();
  await page.getByRole("radio", { name: "5+0" }).click();
  await page.getByRole("button", { name: "Start game" }).click();
  await page.waitForSelector('[role="grid"]', { timeout: 5000 });
  await page.click('[data-square="d2"]');
  await page.click('[data-square="d4"]');
  await page.waitForTimeout(1500);
});

await browser.close();
