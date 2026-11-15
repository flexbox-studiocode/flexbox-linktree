import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  pageWindow,
  parseActiveFilter,
  parseDateBound,
  parseLinkStatusFilter,
  parseOptionalId,
  parsePageParams,
  parseSearchTerm,
} from "@/features/admin/params";

/**
 * Query parameters are untrusted request input. Parsing must never throw and
 * must always return a bounded, safe value.
 */
describe("parsePageParams", () => {
  it("falls back to documented defaults", () => {
    expect(parsePageParams({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("parses numeric strings", () => {
    expect(parsePageParams({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it("rejects non-positive and non-numeric pages", () => {
    expect(parsePageParams({ page: "0" }).page).toBe(1);
    expect(parsePageParams({ page: "-2" }).page).toBe(1);
    expect(parsePageParams({ page: "abc" }).page).toBe(1);
  });

  it("caps the page size", () => {
    expect(parsePageParams({ pageSize: String(MAX_PAGE_SIZE + 500) }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parsePageParams({ page: ["4", "9"] }).page).toBe(4);
  });
});

describe("parseSearchTerm", () => {
  it("trims and bounds free text", () => {
    expect(parseSearchTerm("  logo  ")).toBe("logo");
    expect(parseSearchTerm("x".repeat(500))).toHaveLength(120);
    expect(parseSearchTerm(undefined)).toBe("");
  });
});

describe("filter parsers", () => {
  it("accepts known status filters only", () => {
    expect(parseLinkStatusFilter("PUBLISHED")).toBe("PUBLISHED");
    expect(parseLinkStatusFilter("bogus")).toBe("ALL");
    expect(parseLinkStatusFilter(undefined)).toBe("ALL");
  });

  it("accepts known active filters only", () => {
    expect(parseActiveFilter("INACTIVE")).toBe("INACTIVE");
    expect(parseActiveFilter("maybe")).toBe("ALL");
  });
});

describe("parseDateBound", () => {
  it("parses an ISO date at UTC midnight", () => {
    expect(parseDateBound("2026-11-15")?.toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });

  it("extends an inclusive end bound to the end of the day", () => {
    expect(parseDateBound("2026-11-15", "end")?.toISOString()).toBe("2026-11-15T23:59:59.999Z");
  });

  it("ignores malformed input", () => {
    expect(parseDateBound("15/11/2026")).toBeUndefined();
    expect(parseDateBound("2026-13-40")).toBeUndefined();
    expect(parseDateBound(undefined)).toBeUndefined();
  });
});

describe("parseOptionalId", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(parseOptionalId("2b1f0f4c-0000-4000-8000-000000000000")).toBe(
      "2b1f0f4c-0000-4000-8000-000000000000",
    );
    expect(parseOptionalId("not-a-uuid")).toBeUndefined();
    expect(parseOptionalId("' OR 1=1 --")).toBeUndefined();
  });
});

describe("pageWindow", () => {
  it("produces an empty window for an empty result set", () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it("centres the window and clamps to the range", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 5)).toEqual([3, 4, 5]);
    expect(pageWindow(10, 20, 1)).toEqual([9, 10, 11]);
  });
});