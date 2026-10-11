import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://localhost:5213/states?date=2026-10-17", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

// Type into combobox and check dropdown filtering works, with keyboard only.
await page.keyboard.press("Tab"); // focus from body; GameLayout header has links first though
const input = page.getByRole("combobox");
await input.click();
await input.type("Orissa");
await page.waitForTimeout(150);
await page.screenshot({ path: "/tmp/states-check/typed-orissa.png" });

await input.press("Enter");
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/states-check/after-guess-1.png" });

// Try an invalid guess (shake)
await input.type("Narnia");
await input.press("Enter");
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/states-check/invalid-shake.png" });
await input.fill("");

// Guess remaining wrong states to force a loss, and check end state / result modal.
const guesses = ["Karnataka", "Kerala", "Punjab", "Goa", "Assam"];
for (const g of guesses) {
  await input.fill("");
  await input.type(g);
  await page.waitForTimeout(80);
  await input.press("Enter");
  await page.waitForTimeout(600);
}
await page.screenshot({ path: "/tmp/states-check/after-loss.png", fullPage: true });

console.log("console/page errors:", JSON.stringify(errors, null, 2));
await browser.close();
