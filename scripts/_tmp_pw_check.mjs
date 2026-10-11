import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:5209/worldle?date=2026-10-17", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const svgCount = await page.locator("svg.worldle-silhouette path").count();
console.log("silhouette paths:", svgCount);

// type into autocomplete
await page.getByPlaceholder("Type a country…").fill("nau");
await page.waitForTimeout(200);
const options = await page.locator('[role="option"]').allTextContents();
console.log("suggestions for 'nau':", options);

await page.locator('[role="option"]').first().click();
await page.waitForTimeout(300);
const rows = await page.locator("ul >> li:has(.fi)").count();
console.log("guess rows after 1 guess:", rows);

console.log("console errors:", errors);
await page.screenshot({ path: "/tmp/worldle-check.png", fullPage: true });
await browser.close();
