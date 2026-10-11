import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR", String(e)));

// Day 2 (2026-10-18) answer: let's just discover via a different day with a fresh localStorage.
await page.goto("http://localhost:5201/wordle?date=2026-10-18", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

// Turn on hard mode before first guess.
await page.click('input[type="checkbox"]');
await page.screenshot({ path: "/tmp/wordle-hardmode-on.png" });

// First guess: SOARE (common starter) — whatever it reveals, we then try to violate hard mode.
await page.keyboard.type("SOARE");
await page.keyboard.press("Enter");
await page.waitForTimeout(1100);
await page.screenshot({ path: "/tmp/wordle-hardmode-guess1.png" });

// Try a guess that definitely omits every letter of SOARE (likely violates hard mode if any hint).
await page.keyboard.type("MUNCH");
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/wordle-hardmode-violation.png" });

const toastText = await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent ?? null);
console.log("Hard mode toast:", toastText);

await browser.close();
