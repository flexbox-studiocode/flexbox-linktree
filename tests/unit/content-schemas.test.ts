import { describe, expect, it } from "vitest";

import { categorySchema } from "@/features/content/schemas/category";
import { approvedInternalAnchors, destinationSchema } from "@/features/content/schemas/destination";
import { linkSchema, publicationTransitionSchema } from "@/features/content/schemas/link";
import { parseSiteSetting, siteSettingSchemas } from "@/features/content/schemas/site-setting";

const categoryId = "6f1c1f9a-6f4b-4b2e-8f12-3c1a2b3c4d5e";

const baseLink = {
  slug: "flexbox-lab",
  categoryId,
  title: "Flexbox Lab",
  description: "Ruang uji untuk ide.",
  icon: "spark" as const,
  tag: "Segera",
  destinationType: "NONE" as const,
  status: "PUBLISHED" as const,
  isActive: true,
  isFeatured: false,
  sortOrder: 2,
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("category validation", () => {
  it("accepts a valid category and trims text", () => {
    const parsed = categorySchema.parse({
      name: "  Pilihan studio ",
      slug: "studio-picks",
      sortOrder: 1,
    });

    expect(parsed.name).toBe("Pilihan studio");
    expect(parsed.isActive).toBe(true);
  });

  it("rejects an invalid slug, empty name, and negative ordering", () => {
    expect(categorySchema.safeParse({ name: "A", slug: "Studio Picks", sortOrder: 1 }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "   ", slug: "studio-picks", sortOrder: 1 }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "A", slug: "studio-picks", sortOrder: -1 }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "A", slug: "studio-picks", sortOrder: 1.5 }).success).toBe(false);
  });
});

describe("destination validation", () => {
  it("accepts approved HTTP(S) and mailto destinations", () => {
    expect(destinationSchema.safeParse({ destinationType: "EXTERNAL", destinationUrl: "https://flexbox.example" }).success).toBe(true);
    expect(destinationSchema.safeParse({ destinationType: "EXTERNAL", destinationUrl: "mailto:hello@example.com" }).success).toBe(true);
  });

  it("rejects unsafe external schemes", () => {
    for (const value of ["javascript:alert(1)", "data:text/html;base64,AA==", "vbscript:msgbox(1)", "//evil.example", "/admin"]) {
      expect(destinationSchema.safeParse({ destinationType: "EXTERNAL", destinationUrl: value }).success).toBe(false);
    }
  });

  it("rejects malformed URL structure", () => {
    expect(destinationSchema.safeParse({ destinationType: "EXTERNAL", destinationUrl: "not a url" }).success).toBe(false);
    expect(destinationSchema.safeParse({ destinationType: "EXTERNAL", destinationUrl: "https://" }).success).toBe(false);
  });

  it("accepts only approved internal anchors", () => {
    expect(approvedInternalAnchors).toContain("#kontak");
    expect(destinationSchema.safeParse({ destinationType: "INTERNAL", internalAnchor: "#kontak" }).success).toBe(true);
    expect(destinationSchema.safeParse({ destinationType: "INTERNAL", internalAnchor: "#unknown" }).success).toBe(false);
    expect(destinationSchema.safeParse({ destinationType: "INTERNAL", internalAnchor: "https://evil.example" }).success).toBe(false);
    expect(destinationSchema.safeParse({ destinationType: "INTERNAL", internalAnchor: "//evil.example" }).success).toBe(false);
  });

  it("keeps NONE destinations free of any destination value", () => {
    expect(destinationSchema.safeParse({ destinationType: "NONE" }).success).toBe(true);
    expect(destinationSchema.safeParse({ destinationType: "NONE", destinationUrl: "https://example.com" }).success).toBe(false);
    expect(destinationSchema.safeParse({ destinationType: "NONE", internalAnchor: "#kontak" }).success).toBe(false);
  });
});

describe("link validation", () => {
  it("accepts a published non-interactive link", () => {
    expect(linkSchema.safeParse(baseLink).success).toBe(true);
  });

  it("accepts an internal anchor link", () => {
    const parsed = linkSchema.safeParse({
      ...baseLink,
      slug: "terhubung",
      destinationType: "INTERNAL",
      internalAnchor: "#kontak",
      tag: undefined,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects inconsistent destination type/value combinations", () => {
    expect(linkSchema.safeParse({ ...baseLink, destinationType: "EXTERNAL" }).success).toBe(false);
    expect(linkSchema.safeParse({ ...baseLink, destinationType: "INTERNAL" }).success).toBe(false);
    expect(linkSchema.safeParse({ ...baseLink, destinationUrl: "https://example.com" }).success).toBe(false);
    expect(linkSchema.safeParse({ ...baseLink, destinationType: "EXTERNAL", internalAnchor: "#kontak", destinationUrl: "https://example.com" }).success).toBe(false);
  });

  it("rejects inconsistent publication timestamps", () => {
    expect(linkSchema.safeParse({ ...baseLink, status: "PUBLISHED", publishedAt: null }).success).toBe(false);
    expect(linkSchema.safeParse({ ...baseLink, status: "DRAFT" }).success).toBe(false);
    expect(linkSchema.safeParse({ ...baseLink, status: "DRAFT", publishedAt: null }).success).toBe(true);
  });

  it("rejects a non-UUID category reference", () => {
    expect(linkSchema.safeParse({ ...baseLink, categoryId: "studio-picks" }).success).toBe(false);
  });
});

describe("publication transitions", () => {
  it("allows deliberate lifecycle moves", () => {
    const allowed = [
      ["DRAFT", "PUBLISHED"],
      ["DRAFT", "ARCHIVED"],
      ["PUBLISHED", "DRAFT"],
      ["PUBLISHED", "ARCHIVED"],
      ["ARCHIVED", "DRAFT"],
      ["ARCHIVED", "PUBLISHED"],
    ];

    for (const [from, to] of allowed) {
      expect(publicationTransitionSchema.safeParse({ from, to }).success).toBe(true);
    }
  });

  it("rejects unknown statuses", () => {
    expect(publicationTransitionSchema.safeParse({ from: "DRAFT", to: "LIVE" }).success).toBe(false);
  });
});

describe("site setting validation", () => {
  it("accepts every known setting key with its typed shape", () => {
    const values: Record<keyof typeof siteSettingSchemas, unknown> = {
      general: { name: "Flexbox Studio", wordmark: "Flexbox", wordmarkSuffix: "Studio", supportingLabel: "Digital directory" },
      navigation: { headerNavLabel: "Jelajahi", contactNavLabel: "Kontak", headerCtaLabel: "Mari terhubung" },
      hero: { heroEyebrow: "Digital hub", heroTitle: "Ide fleksibel.", heroDescription: "Satu pintu.", heroCtaLabel: "Jelajahi direktori" },
      directory: { directoryEyebrow: "01 / Direktori", directoryTitle: "Jelajahi Flexbox", directoryDescription: "Delapan tujuan utama." },
      contact: {
        contactEyebrow: "02 / Kontak",
        contactTitle: "Punya ide?",
        contactDescription: "Mari membuka percakapan.",
        contactCtaLabel: "Mulai percakapan",
        contactPendingLabel: "Kanal kontak segera dipublikasikan",
        contactEmail: null,
      },
      footer: { footerTagline: "Ide fleksibel.", copyrightName: "Flexbox Studio" },
      seo: { title: "Flexbox Studio — Digital Hub", description: "Direktori digital.", canonicalUrl: null, openGraphImage: null },
    };

    for (const [key, value] of Object.entries(values)) {
      expect(parseSiteSetting(key as keyof typeof siteSettingSchemas, value)).toEqual(value);
    }
  });

  it("rejects invalid site settings", () => {
    expect(() => parseSiteSetting("general", { name: "" })).toThrow();
    expect(() => parseSiteSetting("contact", { contactEmail: "not-an-email" })).toThrow();
    expect(() => parseSiteSetting("hero", { heroTitle: "x", unexpected: true })).toThrow();
    expect(() => parseSiteSetting("seo", { title: "Ok", description: "Ok", canonicalUrl: "javascript:alert(1)", openGraphImage: null })).toThrow();
  });

  it("keeps the pending contact destination unpublished", () => {
    const contact = parseSiteSetting("contact", {
      contactEyebrow: "02 / Kontak",
      contactTitle: "Punya ide?",
      contactDescription: "Mari membuka percakapan.",
      contactCtaLabel: "Mulai percakapan",
      contactPendingLabel: "Kanal kontak segera dipublikasikan",
      contactEmail: null,
    });

    expect(contact.contactEmail).toBeNull();
  });
});
