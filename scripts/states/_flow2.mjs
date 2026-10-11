import { chromium } from "playwright";

const browser = await chromium.launch();

// --- Win scenario, mobile viewport ---
const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:5213/states?date=2026-10-17", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/states-check/mobile-start.png" });

const input = page.getByRole("combobox");
await input.click();
await input.type("Delhi");
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/states-check/mobile-dropdown.png" });
await input.press("Enter");
await page.waitForTimeout(700);
await page.screenshot({ path: "/tmp/states-check/mobile-win.png", fullPage: true });

// Close modal, check help modal too.
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.getByRole("button", { name: /how to play/i }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/states-check/mobile-help.png" });
await page.keyboard.press("Escape");

// Reload: finished play should persist and show read-only board.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/states-check/mobile-reload-finished.png" });

console.log("errors:", JSON.stringify(errors, null, 2));
await browser.close();
