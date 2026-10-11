import { chromium } from "playwright";

const browser = await chromium.launch();

async function run(date, width, outPath, guesses) {
  const page = await browser.newPage({ viewport: { width, height: width <= 480 ? 844 : 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(`http://localhost:5209/worldle?date=${date}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  for (const g of guesses) {
    await page.getByPlaceholder("Type a country…").fill(g);
    await page.waitForTimeout(200);
    const count = await page.locator('[role="option"]').count();
    if (count === 0) {
      console.log(`  no suggestions for "${g}"`);
      continue;
    }
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(250);
  }

  await page.screenshot({ path: outPath, fullPage: true });
  console.log(outPath, "errors:", errors);
  await page.close();
}

// Day 2027-01-16 (puzzle #92) = Rwanda, per samples.md
await run("2027-01-16", 1280, "/tmp/worldle-mid-desktop.png", ["France", "Kenya"]);
await run("2027-01-16", 375, "/tmp/worldle-mid-mobile.png", []);

await browser.close();
