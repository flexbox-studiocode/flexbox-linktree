import { describe, expect, it } from "vitest";

import { publicAnchors, publicCategories, siteContent } from "@/features/public/content";
import { getDestinationKind, isAllowedDestinationUrl } from "@/lib/utils/url";

const categories = [...publicCategories].sort((a, b) => a.sortOrder - b.sortOrder);
const links = categories.flatMap((category) =>
  [...category.links].sort((a, b) => a.sortOrder - b.sortOrder),
);
const internalTargets: Set<string> = new Set(Object.values(publicAnchors));

describe("public directory data", () => {
  it("provides non-empty categories with unique slugs and ordered links", () => {
    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories.map((category) => category.slug)).size).toBe(categories.length);

    for (const category of categories) {
      expect(category.title.trim()).not.toBe("");
      expect(category.slug).toMatch(/^[a-z0-9-]+$/);
      expect(category.links.length).toBeGreaterThan(0);
      expect(category.links.every((link) => link.category === category.slug)).toBe(true);
    }
  });

  it("has unique IDs and globally ordered link sort values", () => {
    expect(new Set(links.map((link) => link.id)).size).toBe(links.length);
    expect(links.map((link) => link.sortOrder)).toEqual(
      [...links].map((link) => link.sortOrder).sort((a, b) => a - b),
    );
  });

  it("contains the eight requested examples", () => {
    expect(links.map((link) => link.title)).toEqual([
      "Flexbox Design System",
      "Flexbox Lab",
      "Website Flexbox",
      "Sumber Daya",
      "Karya Digital",
      "Eksperimen Visual",
      "Terhubung dengan Kami",
      "Kolaborasi & Kemitraan",
    ]);
  });

  it("keeps content complete and does not publish unverified destinations", () => {
    for (const link of links) {
      expect(link.title.trim()).not.toBe("");
      expect(link.description.trim()).not.toBe("");
      if (!link.href) expect(link.tag).toBeTruthy();
    }

    expect(links.filter((link) => !link.href)).toHaveLength(6);
  });

  it("allows only intentional internal anchors or safe verified destination schemes", () => {
    for (const link of links) {
      if (!link.href) continue;
      if (link.href.startsWith("#")) {
        expect(internalTargets.has(link.href)).toBe(true);
      } else {
        expect(isAllowedDestinationUrl(link.href)).toBe(true);
        expect(getDestinationKind(link.href)).not.toBeNull();
      }
      expect(link.href.toLowerCase()).not.toMatch(/^(javascript|data|vbscript):/);
    }
  });

  it("keeps the hero copy in the central content configuration", () => {
    expect(siteContent.heroTitle).toBe("Ide fleksibel. Karya nyata.");
    expect(siteContent.name).toBe("Flexbox Studio");
  });
});

describe("public page source structure", () => {
  it("renders semantic sections, matching internal anchors, and no search/filter UI", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("src/app/page.tsx", "utf8");
    const directory = await readFile("src/components/public/directory.tsx", "utf8");
    const contact = await readFile("src/components/public/contact-cta.tsx", "utf8");

    expect(source).toContain('id="konten"');
    expect(directory).toContain('id="direktori"');
    expect(contact).toContain('id="kontak"');
    expect(source).toContain("<main");
    expect(source + directory).toContain("<section");
    expect(source + directory).not.toMatch(/placeholder=.*(cari|search)/i);
    expect(source + directory).not.toMatch(/filter|pagination|counter/i);
  });
});