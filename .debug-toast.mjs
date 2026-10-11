import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });
await page.goto("http://localhost:5201/wordle?date=2026-10-17", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.keyboard.type("ZZZZZ");
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
const info = await page.evaluate(() => {
  const el = document.querySelector('[role="alert"]');
  if (!el) return { found: false };
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return {
    found: true,
    text: el.textContent,
    rect,
    opacity: style.opacity,
    zIndex: style.zIndex,
    display: style.display,
    visibility: style.visibility,
    background: style.backgroundColor,
    color: style.color,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.waitForTimeout(150);
await page.screenshot({ path: "/tmp/debug-toast.png" });
await browser.close();
