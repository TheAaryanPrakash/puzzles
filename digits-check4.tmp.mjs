import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:5205/digits?date=2026-10-23", { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const circles = page.locator(".digits-circle");

// Round 1: do one legal merge, then undo it, then submit with 0 steps.
console.log("R1 values:", await circles.allTextContents());
await circles.nth(0).click();
await page.getByRole("button", { name: "add" }).click();
await circles.nth(1).click();
await page.waitForTimeout(600);
console.log("R1 after merge:", await circles.allTextContents());
await page.getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(600);
console.log("R1 after undo:", await circles.allTextContents());

// Try an illegal subtraction (smaller - bigger) to trigger the shake/error path.
const vals1 = (await circles.allTextContents()).map(Number);
const smallIdx = vals1.indexOf(Math.min(...vals1));
const bigIdx = vals1.indexOf(Math.max(...vals1));
await circles.nth(smallIdx).click();
await page.getByRole("button", { name: "subtract" }).click();
await circles.nth(bigIdx).click();
await page.waitForTimeout(300);
const errorText = await page.locator('[aria-live="polite"]').textContent();
console.log("illegal-move error text:", JSON.stringify(errorText));
console.log("R1 count still (should be unchanged, illegal move rejected):", await circles.count());

await page.getByRole("button", { name: "Submit" }).click();
await page.waitForTimeout(400);
console.log("after R1 submit, active round should be R2 now");
await page.screenshot({ path: "digits-r2.png" });

// Submit rounds 2-5 with 0 steps each.
for (let i = 0; i < 4; i++) {
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(400);
}

await page.waitForTimeout(500);
await page.screenshot({ path: "digits-result.png", fullPage: true });

console.log("console/page errors:", errors);

const ls = await page.evaluate(() =>
  Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.includes("digits"))),
);
console.log("final localStorage:", JSON.stringify(ls, null, 2));

await browser.close();
