import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:5209/worldle?date=2027-04-17", { waitUntil: "networkidle" });
await page.waitForTimeout(400);

for (const g of ["France", "Kenya"]) {
  await page.getByPlaceholder("Type a country…").fill(g);
  await page.waitForTimeout(200);
  await page.locator('[role="option"]').first().click();
  await page.waitForTimeout(700); // clear the save debounce comfortably
}

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
const guessText = await page.getByText(/Guess \d\/6/).textContent();
console.log("after reload:", guessText);
const rowCount = await page.locator("ul li .fi").count();
console.log("restored guess rows:", rowCount);
console.log("errors:", errors);

await page.screenshot({ path: "/tmp/worldle-restore.png", fullPage: true });

// keyboard-only pass: tab to the input, type, arrow down, enter
await page.keyboard.press("Tab"); // back link
await page.keyboard.press("Tab"); // archive
await page.keyboard.press("Tab"); // help
await page.keyboard.press("Tab"); // should land on the autocomplete input now
const focused = await page.evaluate(() => document.activeElement?.getAttribute("placeholder"));
console.log("focused element placeholder:", focused);
await page.keyboard.type("Chad");
await page.waitForTimeout(200);
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
const rowCount2 = await page.locator("ul li .fi").count();
console.log("rows after keyboard guess:", rowCount2);

await browser.close();
