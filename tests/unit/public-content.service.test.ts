import { describe, expect, it } from "vitest";

import { fallbackSiteContent } from "@/features/content/fallbacks";
import { composePublicContent } from "@/features/content/services/content";
import { makeCategory, makeLink } from "../helpers/fixtures";

const settings: Record<string, unknown> = {
  general: { name: "Flexbox Studio", wordmark: "Flexbox", wordmarkSuffix: "Studio", supportingLabel: "Digital directory" },
  navigation: { headerNavLabel: "Jelajahi", contactNavLabel: "Kontak", headerCtaLabel: "Mari terhubung" },
  hero: {
    heroEyebrow: "Digital hub / Direktori 01",
    heroTitle: "Ide fleksibel. Karya nyata.",
    heroDescription: "Satu pintu.",
    heroCtaLabel: "Jelajahi direktori",
  },
  directory: { directoryEyebrow: "01 / Direktori", directoryTitle: "Jelajahi Flexbox", directoryDescription: "Delapan tujuan utama." },
  contact: {
    contactEyebrow: "02 / Kontak",
    contactTitle: "Punya ide untuk diwujudkan?",
    contactDescription: "Mari membuka percakapan.",
    contactCtaLabel: "Mulai percakapan",
    contactPendingLabel: "Kanal kontak segera dipublikasikan",
    contactEmail: null,
  },
  footer: { footerTagline: "Ide fleksibel. Karya nyata.", copyrightName: "Flexbox Studio" },
};

describe("composePublicContent", () => {
  it("composes site copy from validated settings", () => {
    const { site } = composePublicContent([], settings);

    expect(site.heroTitle).toBe("Ide fleksibel. Karya nyata.");
    expect(site.directoryTitle).toBe("Jelajahi Flexbox");
    expect(site.contactEmail).toBeNull();
  });

  it("falls back per key when a setting is missing or invalid", () => {
    const { site } = composePublicContent([], {
      ...settings,
      // Invalid: empty name.
      general: { name: "", wordmark: "Flexbox", wordmarkSuffix: "Studio", supportingLabel: "Digital directory" },
      // Missing: hero is absent entirely.
      hero: undefined,
    });

    expect(site.name).toBe(fallbackSiteContent.name);
    expect(site.wordmark).toBe("Flexbox");
    expect(site.heroTitle).toBe(fallbackSiteContent.heroTitle);
  });

  it("returns the documented fallback when settings are unavailable", () => {
    const { site } = composePublicContent([], null);

    expect(site).toEqual(fallbackSiteContent);
  });

  it("returns an empty directory when the content query is unavailable", () => {
    const result = composePublicContent(null, settings);

    expect(result.categories).toEqual([]);
    expect(result.isEmpty).toBe(true);
  });

  it("keeps published links and reports a non-empty directory", () => {
    const category = makeCategory({ name: "Pilihan studio", slug: "studio-picks", sortOrder: 1 });
    const links = [
      makeLink({ categoryId: category.id, slug: "a", sortOrder: 1 }),
      makeLink({ categoryId: category.id, slug: "b", sortOrder: 2, destinationType: "INTERNAL", internalAnchor: "#kontak" }),
    ];

    const result = composePublicContent([{ ...category, links }], settings);

    expect(result.isEmpty).toBe(false);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].links.map((link) => link.id)).toEqual(["a", "b"]);
  });

  it("never emits a visitor-facing counter field", () => {
    const category = makeCategory();
    const result = composePublicContent([{ ...category, links: [makeLink({ categoryId: category.id })] }], settings);

    expect(Object.keys(result).sort()).toEqual(["categories", "isEmpty", "site"]);
  });
});
