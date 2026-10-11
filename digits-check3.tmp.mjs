import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto("http://localhost:5205/digits?date=2026-10-22", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

const circles = page.locator(".digits-circle");
console.log("initial values:", await circles.allTextContents());

await circles.nth(0).click();
await page.getByRole("button", { name: "add" }).click();
await circles.nth(1).click();

for (const wait of [200, 500, 1000, 1500, 2000]) {
  await page.waitForTimeout(wait === 200 ? 200 : 300);
  console.log(`+${wait}ms total, count:`, await circles.count(), await circles.allTextContents());
}

await browser.close();
