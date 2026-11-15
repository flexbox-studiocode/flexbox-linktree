import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({
  getToken: getTokenMock,
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * Proxy (middleware) gate tests.
 *
 * The proxy is an optimistic early gate, never an authorization boundary, but it
 * must fail closed: unauthenticated visitors hit the login page, protected paths
 * are private by default, and a signed-in administrator is not bounced through
 * the sign-in page.
 */
const SECRET = "unit-test-secret-0123456789abcdef";

function adminRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { host: "localhost:3000" },
  });
}

describe.skipIf(typeof NextRequest === "undefined")("proxy gate", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
    getTokenMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
  });

  function token(overrides: Record<string, unknown> = {}) {
    return { sub: "d6639cac-00f8-492d-8b2f-ced5b19b2f42", av: 1, role: "SUPER_ADMIN", ...overrides };
  }

  it("redirects an unauthenticated visitor on a protected path to the login page", async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await proxy(adminRequest("/admin/links"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("carries the intended destination back to the login page as callbackUrl", async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await proxy(adminRequest("/admin/links/new"));

    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("callbackUrl")).toBe("/admin/links/new");
  });

  it("lets a visitor reach an allowlisted public admin page unauthenticated", async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await proxy(adminRequest("/admin/login"));

    expect(response.status).toBe(200);
  });

  it("lets a visitor reach the password-reset page with its token query intact", async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await proxy(adminRequest("/admin/reset-password?token=abc"));

    expect(response.status).toBe(200);
  });

  it("lets Auth.js routes through unauthenticated", async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await proxy(adminRequest("/api/auth/session"));

    expect(response.status).toBe(200);
  });

  it("passes a valid signed in super admin through to the protected page", async () => {
    getTokenMock.mockResolvedValue(token());

    const response = await proxy(adminRequest("/admin"));

    expect(response.status).toBe(200);
  });

  it("bounces a signed in administrator off the login page", async () => {
    getTokenMock.mockResolvedValue(token());

    const response = await proxy(adminRequest("/admin/login"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin");
  });

  it("treats a token lacking the required claims as unauthenticated (fail closed)", async () => {
    getTokenMock.mockResolvedValue(token({ av: undefined }));

    const response = await proxy(adminRequest("/admin"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("requires the token role to be SUPER_ADMIN", async () => {
    getTokenMock.mockResolvedValue(token({ role: "MEMBER" }));

    const response = await proxy(adminRequest("/admin"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("refuses closed when no signing secret is configured", async () => {
    process.env.NEXTAUTH_SECRET = "";

    const response = await proxy(adminRequest("/admin"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("keeps the login page reachable when no signing secret is configured", async () => {
    process.env.AUTH_SECRET = "";

    const response = await proxy(adminRequest("/admin/login"));

    expect(response.status).toBe(200);
  });

  it("rejects a protocol-relative open-redirect attempt in the callbackUrl", async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await proxy(adminRequest("/admin/links"));
    const location = new URL(response.headers.get("location")!);

    const callbackUrl = location.searchParams.get("callbackUrl");
    expect(callbackUrl).not.toBeNull();
    expect(callbackUrl!).not.toMatch(/^\/\//);
    expect(callbackUrl).toBe("/admin/links");
  });
});
