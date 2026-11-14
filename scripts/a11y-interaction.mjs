/**
 * Phase 2 zoom and keyboard checks.
 *
 * - Simulates 200% browser zoom by halving the CSS viewport (Chrome's zoom
 *   divides the layout viewport), then verifies no overflow and that nothing
 *   is clipped.
 * - Activates every internal anchor and confirms the target heading is not
 *   hidden behind the sticky header.
 * - Tabs through the page and reports the focus order.
 */
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome" });
const report = {};

// 200% zoom: 1280px physical window behaves like a 640px CSS viewport.
{
  const context = await browser.newContext({
    viewport: { width: 640, height: 450 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  report.zoom200 = await page.evaluate(() => {
    const root = document.documentElement;
    const clipped = [];
    for (const element of document.querySelectorAll("h1,h2,h3,p,a")) {
      if (element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow !== "visible") {
        clipped.push(element.textContent.trim().slice(0, 40));
      }
    }
    return {
      cssViewport: `${root.clientWidth}x${root.clientHeight}`,
      overflowX: root.scrollWidth > root.clientWidth,
      clippedElements: clipped,
      cardColumns: (() => {
        const cards = [...document.querySelectorAll(".link-card")];
        if (cards.length < 2) return 1;
        return cards[0].getBoundingClientRect().top === cards[1].getBoundingClientRect().top ? 2 : 1;
      })(),
    };
  });
  await context.close();
}

// Anchor offsets under the sticky header.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const headerHeight = await page.evaluate(
    () => document.querySelector(".site-header").getBoundingClientRect().height,
  );

  const checks = [];
  for (const id of ["direktori", "kontak"]) {
    await page.evaluate((target) => {
      document.querySelector(`a[href="#${target}"]`).click();
    }, id);
    await page.waitForTimeout(700);
    checks.push(
      await page.evaluate(
        ({ target, header }) => {
          const section = document.getElementById(target);
          const rect = section.getBoundingClientRect();
          const heading = section.querySelector("h2");
          const headingTop = heading ? heading.getBoundingClientRect().top : rect.top;
          return {
            target,
            sectionTop: Math.round(rect.top),
            headingTop: Math.round(headingTop),
            clearsHeader: headingTop >= header,
          };
        },
        { target: id, header: headerHeight },
      ),
    );
  }
  report.anchorOffsets = { headerHeight, checks };
  await page.close();
}

// Keyboard order.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const order = [];
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        return {
          tag: active.tagName,
          text: active.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
          visible: active.getBoundingClientRect().height > 0,
        };
      }),
    );
  }
  report.tabOrder = order;
  await page.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));