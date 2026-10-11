import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("[pageerror]", String(err)));

await page.goto("http://localhost:5205/digits?date=2026-10-21", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

const circles = page.locator(".digits-circle");
console.log("initial values:", await circles.allTextContents());

await circles.nth(0).click();
await page.waitForTimeout(150);
console.log(
  "after selecting tile0, aria-pressed states:",
  await circles.evaluateAll((els) => els.map((e) => e.getAttribute("aria-pressed"))),
);

const addBtn = page.getByRole("button", { name: "add" });
console.log("add button disabled?", await addBtn.isDisabled());
await addBtn.click();
await page.waitForTimeout(150);
console.log("op add selected?", await addBtn.getAttribute("data-selected"));

await circles.nth(1).click();
await page.waitForTimeout(300);
console.log("after second tap, values:", await circles.allTextContents());

const ls = await page.evaluate(() =>
  Object.entries(localStorage).filter(([k]) => k.includes("digits")),
);
console.log("localStorage:", JSON.stringify(ls, null, 2));

await browser.close();
