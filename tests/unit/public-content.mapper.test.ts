import { describe, expect, it } from "vitest";

import {
  resolveDestination,
  toPublicCategory,
  toPublicLink,
} from "@/features/content/mappers/public-content";
import { makeCategory, makeLink } from "../helpers/fixtures";

describe("resolveDestination", () => {
  it("resolves an approved external destination", () => {
    const link = makeLink({ destinationType: "EXTERNAL", destinationUrl: "https://flexbox.example" });

    expect(resolveDestination(link)).toEqual({ kind: "external", href: "https://flexbox.example" });
  });

  it("resolves an approved internal anchor", () => {
    const link = makeLink({ destinationType: "INTERNAL", internalAnchor: "#kontak" });

    expect(resolveDestination(link)).toEqual({ kind: "internal", href: "#kontak" });
  });

  it("keeps a NONE destination non-interactive", () => {
    expect(resolveDestination(makeLink())).toEqual({ kind: "none" });
  });

  it("never exposes an unsafe or malformed external URL", () => {
    for (const destinationUrl of ["javascript:alert(1)", "data:text/html,<b>x", "//evil.example", "/admin", "not a url"]) {
      const link = makeLink({ destinationType: "EXTERNAL", destinationUrl });

      expect(resolveDestination(link)).toEqual({ kind: "none" });
    }
  });

  it("never exposes an external URL in an internal-anchor field", () => {
    const link = makeLink({ destinationType: "INTERNAL", internalAnchor: "https://evil.example" });

    expect(resolveDestination(link)).toEqual({ kind: "none" });
  });

  it("rejects internal anchors that are not approved page sections", () => {
    expect(resolveDestination(makeLink({ destinationType: "INTERNAL", internalAnchor: "#direktori" }))).toEqual({
      kind: "internal",
      href: "#direktori",
    });
    expect(resolveDestination(makeLink({ destinationType: "INTERNAL", internalAnchor: "#unknown" }))).toEqual({ kind: "none" });
    expect(resolveDestination(makeLink({ destinationType: "INTERNAL", internalAnchor: null }))).toEqual({ kind: "none" });
  });

  it("treats an EXTERNAL destination with a missing URL as non-interactive", () => {
    expect(resolveDestination(makeLink({ destinationType: "EXTERNAL", destinationUrl: null }))).toEqual({ kind: "none" });
    expect(resolveDestination(makeLink({ destinationType: "EXTERNAL", destinationUrl: "   " }))).toEqual({ kind: "none" });
  });
});

describe("toPublicLink", () => {
  it("maps a published non-interactive link to the ui shape without an href", () => {
    const link = makeLink({ slug: "flexbox-lab", title: "Flexbox Lab", tag: "Segera", sortOrder: 2 });
    const mapped = toPublicLink(link);

    expect(mapped).toEqual({
      id: "flexbox-lab",
      linkId: link.id,
      title: "Flexbox Lab",
      description: link.description,
      icon: "grid",
      tag: "Segera",
      isFeatured: false,
      sortOrder: 2,
    });
    expect("href" in mapped).toBe(false);
  });

  it("drops admin-only fields", () => {
    const mapped = toPublicLink(makeLink({ slug: "terhubung", destinationType: "INTERNAL", internalAnchor: "#kontak" }));
    const keys = Object.keys(mapped);

    expect(keys).not.toContain("status");
    expect(keys).not.toContain("publishedAt");
    expect(keys).not.toContain("isActive");
    expect(keys).not.toContain("categoryId");
    expect(mapped.href).toBe("#kontak");
  });

  it("falls back to a known icon when the stored icon is unknown", () => {
    expect(toPublicLink(makeLink({ icon: "not-an-icon" })).icon).toBe("grid");
    expect(toPublicLink(makeLink({ icon: null })).icon).toBe("grid");
    expect(toPublicLink(makeLink({ icon: "mail" })).icon).toBe("mail");
  });

  it("uses an empty description rather than undefined", () => {
    expect(toPublicLink(makeLink({ description: null })).description).toBe("");
  });
});

describe("toPublicCategory", () => {
  it("maps a category with links and keeps ordering as provided by the query", () => {
    const category = makeCategory({ name: "Pilihan studio", slug: "studio-picks", sortOrder: 1 });
    const first = makeLink({ categoryId: category.id, slug: "a", sortOrder: 1 });
    const second = makeLink({ categoryId: category.id, slug: "b", sortOrder: 2 });

    expect(toPublicCategory({ ...category, links: [first, second] })).toEqual({
      id: "studio-picks",
      title: "Pilihan studio",
      slug: "studio-picks",
      sortOrder: 1,
      links: [toPublicLink(first), toPublicLink(second)],
    });
  });

  it("hides a category that has no public links", () => {
    const category = makeCategory();

    expect(toPublicCategory({ ...category, links: [] })).toBeNull();
  });
});
