import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:5209/worldle?date=2027-07-17", { waitUntil: "networkidle" });
await page.waitForTimeout(400);

await page.getByPlaceholder("Type a country…").fill("united");
await page.waitForTimeout(250);
await page.screenshot({ path: "/tmp/worldle-mobile-autocomplete.png", fullPage: true });
const opts = await page.locator('[role="option"]').allTextContents();
console.log("options for 'united' at 375px:", opts);

// Help modal
await page.getByPlaceholder("Type a country…").fill("");
await page.getByRole("button", { name: "How to play" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/worldle-mobile-help.png", fullPage: true });
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
const modalVisible = await page.locator('[role="dialog"]').count();
console.log("modal open after escape:", modalVisible);

console.log("errors:", errors);
await browser.close();
