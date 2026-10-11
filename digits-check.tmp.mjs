import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:5205/digits?date=2026-10-20", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

// Round 1: tap first two circles + operator, then submit.
const circles = page.locator(".digits-circle");
const count = await circles.count();
console.log("round1 circle count:", count);
await circles.nth(0).click();
await page.waitForTimeout(100);
await page.getByRole("button", { name: "add" }).click();
await page.waitForTimeout(100);
await circles.nth(1).click();
await page.waitForTimeout(300);
console.log("after merge, circle count:", await circles.count());
await page.screenshot({ path: "/tmp/digits-after-merge.png" });

// Undo
await page.getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(200);
console.log("after undo, circle count:", await circles.count());

// Try illegal subtraction: pick smaller then bigger via operator -
const values = await circles.allTextContents();
console.log("values:", values);

// Submit round 1 (0 steps) and move through all 5 rounds quickly
for (let round = 1; round <= 5; round++) {
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(300);
}

await page.screenshot({ path: "/tmp/digits-after-all-submits.png", fullPage: true });
console.log("errors:", errors);

await browser.close();
