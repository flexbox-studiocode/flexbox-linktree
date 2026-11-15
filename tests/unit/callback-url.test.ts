import { describe, expect, it } from "vitest";

import { ADMIN_HOME_PATH, sanitizeCallbackUrl } from "@/lib/auth/callback-url";

/**
 * `callbackUrl` is attacker-controlled. These cases pin the open-redirect
 * protections: only same-origin `/admin` paths may survive sanitisation.
 */
describe("sanitizeCallbackUrl", () => {
  it("falls back to the admin home for non-string input", () => {
    expect(sanitizeCallbackUrl(undefined)).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl(null)).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl(42)).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("")).toBe(ADMIN_HOME_PATH);
  });

  it("keeps a legitimate admin path", () => {
    expect(sanitizeCallbackUrl("/admin")).toBe("/admin");
    expect(sanitizeCallbackUrl("/admin/links")).toBe("/admin/links");
    expect(sanitizeCallbackUrl("/admin/links/new")).toBe("/admin/links/new");
  });

  it("keeps a query string on an allowed path", () => {
    expect(sanitizeCallbackUrl("/admin/links?page=2")).toBe("/admin/links?page=2");
  });

  it("strips a trailing slash", () => {
    expect(sanitizeCallbackUrl("/admin/links/")).toBe("/admin/links");
    expect(sanitizeCallbackUrl("/admin/")).toBe("/admin");
  });

  it("rejects absolute URLs, including dangerous schemes", () => {
    expect(sanitizeCallbackUrl("https://evil.test/admin")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("http://evil.test")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("javascript:alert(1)")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("data:text/html,<script>alert(1)</script>")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("file:///etc/passwd")).toBe(ADMIN_HOME_PATH);
  });

  it("rejects protocol-relative and backslash variants", () => {
    expect(sanitizeCallbackUrl("//evil.test/admin")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("/\\evil.test")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("\\\\evil.test")).toBe(ADMIN_HOME_PATH);
  });

  it("rejects control characters, whitespace, and padded values", () => {
    expect(sanitizeCallbackUrl("/admin\nSet-Cookie: x=1")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("/admin\u0000")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl(" /admin")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("/admin/links ")).toBe(ADMIN_HOME_PATH);
  });

  it("rejects paths outside the admin area", () => {
    expect(sanitizeCallbackUrl("/")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("/login")).toBe(ADMIN_HOME_PATH);
    // Prefix match must respect a segment boundary.
    expect(sanitizeCallbackUrl("/administrator")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("/adminx?next=/admin")).toBe(ADMIN_HOME_PATH);
  });

  it("never redirects back to the login page itself", () => {
    expect(sanitizeCallbackUrl("/admin/login")).toBe(ADMIN_HOME_PATH);
    expect(sanitizeCallbackUrl("/admin/login?callbackUrl=/admin")).toBe(ADMIN_HOME_PATH);
  });
});
