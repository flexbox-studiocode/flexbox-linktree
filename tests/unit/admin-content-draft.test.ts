import { describe, expect, it } from "vitest";

import {
  ContentAdminError,
  normalizeLinkDraft,
  resolvePublishedAt,
  type LinkDraft,
} from "@/features/content/services/admin-content";

/** Publication timestamp rules and slug normalization for CMS link mutations. */

describe("resolvePublishedAt", () => {
  const existing = new Date("2026-01-05T10:00:00.000Z");
  const now = new Date("2026-11-15T12:00:00.000Z");

  it("clears the timestamp for a draft", () => {
    expect(resolvePublishedAt({ status: "DRAFT", existing, now })).toBeNull();
  });

  it("sets the timestamp on first publication", () => {
    expect(resolvePublishedAt({ status: "PUBLISHED", existing: null, now })).toBe(now);
  });

  it("keeps the first publication instant on re-publication", () => {
    expect(resolvePublishedAt({ status: "PUBLISHED", existing, now })).toBe(existing);
  });

  it("keeps an existing timestamp for an archived link", () => {
    expect(resolvePublishedAt({ status: "ARCHIVED", existing, now })).toBe(existing);
  });

  it("leaves an archived link without a timestamp when it was never published", () => {
    expect(resolvePublishedAt({ status: "ARCHIVED", existing: null, now })).toBeNull();
  });
});

const baseDraft: LinkDraft = {
  slug: "",
  categoryId: "2b1f0f4c-0000-4000-8000-000000000000",
  title: "Sumber Daya Flexbox",
  description: null,
  icon: null,
  tag: null,
  destinationType: "EXTERNAL",
  destinationUrl: "https://example.com/sumber-daya",
  internalAnchor: null,
  status: "DRAFT",
  isActive: true,
  isFeatured: false,
  sortOrder: 1,
};

describe("normalizeLinkDraft", () => {
  it("derives a slug from the title when none is provided", () => {
    const result = normalizeLinkDraft(baseDraft);

    expect(result.slug).toBe("sumber-daya-flexbox");
    expect(result.publishedAt).toBeNull();
  });

  it("keeps a provided slug", () => {
    expect(normalizeLinkDraft({ ...baseDraft, slug: "alat-desain" }).slug).toBe("alat-desain");
  });

  it("rejects a slug that is not URL-safe", () => {
    expect(() => normalizeLinkDraft({ ...baseDraft, slug: "Slug Tidak Valid" })).toThrowError(ContentAdminError);
  });

  it("drops destination values that do not belong to the chosen type", () => {
    const external = normalizeLinkDraft({
      ...baseDraft,
      internalAnchor: "#kontak",
    });

    expect(external.destinationUrl).toBe("https://example.com/sumber-daya");
    expect(external.internalAnchor).toBeNull();

    const none = normalizeLinkDraft({
      ...baseDraft,
      destinationType: "NONE",
      destinationUrl: "https://example.com",
      internalAnchor: "#kontak",
    });

    expect(none.destinationUrl).toBeNull();
    expect(none.internalAnchor).toBeNull();
  });

  it("rejects an internal anchor outside the approved list", () => {
    expect(() =>
      normalizeLinkDraft({
        ...baseDraft,
        destinationType: "INTERNAL",
        destinationUrl: null,
        internalAnchor: "#admin",
      }),
    ).toThrowError(ContentAdminError);
  });

  it("rejects a non-HTTP(S) external destination", () => {
    expect(() =>
      normalizeLinkDraft({ ...baseDraft, destinationUrl: "javascript:alert(1)" }),
    ).toThrowError(ContentAdminError);
  });

  it("sets publishedAt when the draft is published", () => {
    const result = normalizeLinkDraft({ ...baseDraft, status: "PUBLISHED" });

    expect(result.publishedAt).toBeInstanceOf(Date);
  });
});