import { describe, expect, it } from "vitest";

import { isValidSlug, slugify } from "@/lib/utils/slug";

describe("slugify", () => {
  it("normalizes accents, spaces, and punctuation", () => {
    expect(slugify("Sumber Daya & Alat")).toBe("sumber-daya-alat");
    expect(slugify("  Karya   Digital  ")).toBe("karya-digital");
    expect(slugify("Café Été")).toBe("cafe-ete");
  });

  it("drops characters that cannot appear in a slug", () => {
    expect(slugify("Halo, Dunia! (2026)")).toBe("halo-dunia-2026");
    expect(slugify("a_b/c")).toBe("a-b-c");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("---contoh---")).toBe("contoh");
  });

  it("returns an empty string for input with no usable characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase alphanumeric segments separated by single dashes", () => {
    expect(isValidSlug("sumber-daya")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("2026")).toBe(true);
  });

  it.each(["", "Sumber Daya", "Sumber-Daya", "-awal", "akhir-", "ganda--dash", "garis_bawah", "a".repeat(161)])(
    "rejects %s",
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );

  it("accepts a 160-character slug and rejects 161", () => {
    expect(isValidSlug("a".repeat(160))).toBe(true);
    expect(isValidSlug("a".repeat(161))).toBe(false);
  });
});