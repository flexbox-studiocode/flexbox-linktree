/**
 * Phase 2 accessibility audit script.
 *
 * Checks landmarks, heading structure, accessible names, touch-target sizes,
 * focus visibility, contrast ratios of rendered text, and reduced-motion
 * behaviour. Run with the dev server active:
 *
 *   node scripts/a11y-audit.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://localhost:3000";

const browser = await chromium.launch({ channel: "chrome" });
const results = {};

// 1. Structure, names, and contrast at desktop width.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  results.structure = await page.evaluate(() => {
    const parse = (color) => {
      const numbers = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      // `color(srgb 0.96 0.97 0.98 / 0.5)` reports 0–1 channels, `rgb()` 0–255.
      const normalized = color.startsWith("color(");
      const scale = normalized ? 255 : 1;
      return {
        r: numbers[0] * scale,
        g: numbers[1] * scale,
        b: numbers[2] * scale,
        a: numbers[3] ?? 1,
      };
    };
    const luminance = ({ r, g, b }) => {
      const channel = (value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const contrast = (foreground, background) => {
      const a = luminance(parse(foreground));
      const b = luminance(parse(background));
      const [light, dark] = a > b ? [a, b] : [b, a];
      return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
    };
    const backgroundOf = (element) => {
      // Composite the element's own stack up to the first opaque background so
      // semi-transparent panels resolve to a real colour instead of the page.
      let node = element;
      const stack = [];
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg.a > 0) stack.push(bg);
        if (bg.a >= 0.99) break;
        node = node.parentElement;
      }

      if (stack.length === 0) return getComputedStyle(document.body).backgroundColor;

      const base = stack.pop();
      let mixed = { r: base.r, g: base.g, b: base.b };
      while (stack.length > 0) {
        const top = stack.pop();
        mixed = {
          r: top.r * top.a + mixed.r * (1 - top.a),
          g: top.g * top.a + mixed.g * (1 - top.a),
          b: top.b * top.a + mixed.b * (1 - top.a),
        };
      }
      return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
    };

    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
      level: Number(h.tagName[1]),
      text: h.textContent.trim().slice(0, 60),
    }));

    const linkNames = [...document.querySelectorAll("a")].map((a) => ({
      text: a.textContent.trim().replace(/\s+/g, " ").slice(0, 50),
      hasName: Boolean(a.textContent.trim() || a.getAttribute("aria-label")),
    }));

    const textNodes = [...document.querySelectorAll("p,h1,h2,h3,a,span,li")]
      .filter((el) => {
        if (!el.textContent.trim()) return false;
        if (el.children.length && [...el.childNodes].every((n) => n.nodeType === 1)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((el) => {
        const style = getComputedStyle(el);
        const size = Number.parseFloat(style.fontSize);
        const weight = Number(style.fontWeight);
        const ratio = contrast(style.color, backgroundOf(el));
        const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
        return {
          text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
          size,
          ratio,
          required: isLarge ? 3 : 4.5,
          pass: ratio >= (isLarge ? 3 : 4.5),
        };
      });

    const smallTargets = [...document.querySelectorAll("a,button")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      })
      .filter((target) => target.h < 44 || target.w < 44);

    return {
      landmarks: {
        header: document.querySelectorAll("header").length,
        nav: document.querySelectorAll("nav").length,
        main: document.querySelectorAll("main").length,
        footer: document.querySelectorAll("footer").length,
        section: document.querySelectorAll("section").length,
      },
      h1Count: document.querySelectorAll("h1").length,
      headings,
      unnamedLinks: linkNames.filter((link) => !link.hasName),
      contrastFailures: textNodes.filter((node) => !node.pass),
      smallTargets,
      lang: document.documentElement.lang,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content ?? null,
    };
  });

  // 2. Keyboard focus visibility on the first interactive elements.
  results.focus = await page.evaluate(() => {
    const out = [];
    const targets = [...document.querySelectorAll("a")].slice(0, 6);
    for (const target of targets) {
      target.focus();
      const style = getComputedStyle(target);
      out.push({
        text: target.textContent.trim().replace(/\s+/g, " ").slice(0, 30),
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
      });
    }
    return out;
  });

  // 3. Anchor navigation resolves to an existing target.
  results.anchors = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')].map((a) => {
      const id = a.getAttribute("href").slice(1);
      return { href: a.getAttribute("href"), targetExists: Boolean(document.getElementById(id)) };
    }),
  );

  await page.close();
}

// 4. Reduced-motion media query is respected.
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  results.reducedMotion = await page.evaluate(() => ({
    matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    cardTransition: getComputedStyle(document.querySelector(".link-card")).transitionDuration,
  }));
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));