/**
 * Phase 2 visual QA script.
 *
 * Captures full-page screenshots at the required viewport widths, reports
 * horizontal overflow, and collects console errors plus failed requests.
 *
 * Usage (with the dev server on http://localhost:3000):
 *   node scripts/visual-qa.mjs [baseUrl] [outputDir]
 *
 * It uses `playwright-core` against the locally installed Chrome channel,
 * so no browser download is required.
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const outputDir = resolve(process.argv[3] ?? "screenshots");
const viewports = [
  { name: "mobile-320", width: 320, height: 760 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-600", width: 600, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1440", width: 1440, height: 960 },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.url()} — ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const cards = [...document.querySelectorAll(".link-card")];
    const columns = new Set(
      cards.map((card) => Math.round(card.getBoundingClientRect().top)),
    );
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      overflowX: root.scrollWidth > root.clientWidth,
      h1Count: document.querySelectorAll("h1").length,
      cardCount: cards.length,
      cardsWithAnchor: cards.filter((card) => card.tagName === "A").length,
      twoColumnLayout:
        cards.length > 0 &&
        cards[0].getBoundingClientRect().top ===
          cards[1]?.getBoundingClientRect().top,
      firstCardRows: columns.size,
      headingFont: getComputedStyle(document.querySelector("h1")).fontFamily,
      bodyFont: getComputedStyle(document.body).fontFamily,
    };
  });

  const path = resolve(outputDir, `${viewport.name}.png`);
  await page.screenshot({ path, fullPage: true });

  report.push({
    viewport: `${viewport.width}x${viewport.height}`,
    ...metrics,
    consoleErrors,
    failedRequests,
    screenshot: path,
  });

  await context.close();
}

await browser.close();

console.log(JSON.stringify(report, null, 2));

const problems = report.filter(
  (entry) => entry.overflowX || entry.consoleErrors.length || entry.failedRequests.length,
);
process.exitCode = problems.length > 0 ? 1 : 0;