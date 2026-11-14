import { describe, expect, it } from "vitest";

import { getDestinationKind, isAllowedDestinationUrl } from "@/lib/utils/url";

describe("isAllowedDestinationUrl", () => {
  it("accepts HTTPS and HTTP destinations", () => {
    expect(isAllowedDestinationUrl("https://example.com")).toBe(true);
    expect(isAllowedDestinationUrl("https://example.com/path?q=1")).toBe(true);
    expect(isAllowedDestinationUrl("http://example.com")).toBe(true);
  });

  it("accepts verified mailto destinations", () => {
    expect(isAllowedDestinationUrl("mailto:hello@example.com")).toBe(true);
  });

  it("rejects script and data schemes", () => {
    expect(isAllowedDestinationUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedDestinationUrl("JavaScript:alert(1)")).toBe(false);
    expect(isAllowedDestinationUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isAllowedDestinationUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects protocol-relative and relative values", () => {
    expect(isAllowedDestinationUrl("//evil.example")).toBe(false);
    expect(isAllowedDestinationUrl("/admin")).toBe(false);
    expect(isAllowedDestinationUrl("example.com")).toBe(false);
  });

  it("rejects empty and whitespace-only values", () => {
    expect(isAllowedDestinationUrl("")).toBe(false);
    expect(isAllowedDestinationUrl("   ")).toBe(false);
  });

  it("ignores surrounding whitespace for valid values", () => {
    expect(isAllowedDestinationUrl("  https://example.com  ")).toBe(true);
  });
});

describe("getDestinationKind", () => {
  it("classifies web and email destinations", () => {
    expect(getDestinationKind("https://example.com")).toBe("web");
    expect(getDestinationKind("mailto:hello@example.com")).toBe("email");
  });

  it("returns null for disallowed destinations", () => {
    expect(getDestinationKind("javascript:alert(1)")).toBeNull();
    expect(getDestinationKind("not a url")).toBeNull();
  });
});