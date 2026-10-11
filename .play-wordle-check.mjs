import { chromium } from "playwright";

const base = "http://localhost:5201/wordle?date=2026-10-17";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/wordle-1-initial.png" });

// Day 1 answer is INDIE (seed 1). Type a wrong guess first with a duplicate letter to exercise scoring.
await page.keyboard.type("SLATE");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200); // let the flip animation finish
await page.screenshot({ path: "/tmp/wordle-2-after-guess1.png" });

// Invalid word test
await page.keyboard.type("ZZZZZ");
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/wordle-3-invalid-word-toast.png" });
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");

// Win it
await page.keyboard.type("INDIE");
await page.keyboard.press("Enter");
await page.waitForTimeout(1500); // flip + confetti
await page.screenshot({ path: "/tmp/wordle-4-won.png" });

// Reload to verify restore
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/wordle-5-restored-after-reload.png" });

console.log("console/page errors:", JSON.stringify(errors, null, 2));

await browser.close();
