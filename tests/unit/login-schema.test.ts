import { describe, expect, it } from "vitest";

import { loginSchema } from "@/features/auth/schemas/login";

/**
 * Login form contract tests.
 *
 * The schema validates only shape and presence; email format and credential
 * correctness are enforced on the server to avoid disclosing which checks fail.
 */
describe("loginSchema", () => {
  it("accepts a minimal valid email + password pair", () => {
    const result = loginSchema.safeParse({
      email: "admin@flexbox.example",
      password: "correct-horse-battery-staple",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an optional callbackUrl within the admin area", () => {
    const result = loginSchema.safeParse({
      email: "admin@flexbox.example",
      password: "correct-horse-battery-staple",
      callbackUrl: "/admin/links/new",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = loginSchema.safeParse({ password: "correct-horse-battery-staple" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("email");
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "admin@flexbox.example" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("password");
  });

  it("rejects whitespace-only email", () => {
    const result = loginSchema.safeParse({
      email: "   ",
      password: "correct-horse-battery-staple",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an email longer than 254 characters", () => {
    const longEmail = "a".repeat(250) + "@b.example";

    expect(longEmail.length).toBeGreaterThan(254);

    const result = loginSchema.safeParse({
      email: longEmail,
      password: "correct-horse-battery-staple",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("email");
  });

  it("rejects a password exceeding 256 characters", () => {
    const longPassword = "a".repeat(257);

    const result = loginSchema.safeParse({
      email: "admin@flexbox.example",
      password: longPassword,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("password");
  });

  it("strips unexpected fields instead of passing them to the service", () => {
    const result = loginSchema.safeParse({
      email: "admin@flexbox.example",
      password: "correct-horse-battery-staple",
      role: "SUPER_ADMIN",
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("role");
  });
});
