import { describe, expect, it } from "vitest";

import {
  ARGON2ID_PARAMETERS,
  checkPasswordPolicy,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "@/lib/security/password";

const GOOD_PASSWORD = "correct-horse-battery-9";

describe("argon2id password hashing", () => {
  it("produces an argon2id PHC string", async () => {
    const hash = await hashPassword(GOOD_PASSWORD);

    expect(hash.startsWith("$argon2id$v=19$")).toBe(true);
    expect(hash).toContain(`m=${ARGON2ID_PARAMETERS.memoryCost}`);
    expect(hash).toContain(`t=${ARGON2ID_PARAMETERS.timeCost}`);
    expect(hash).toContain(`p=${ARGON2ID_PARAMETERS.parallelism}`);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword(GOOD_PASSWORD);

    await expect(verifyPassword(hash, GOOD_PASSWORD)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword(GOOD_PASSWORD);

    await expect(verifyPassword(hash, "correct-horse-battery-8")).resolves.toBe(false);
  });

  it("uses a unique salt so identical passwords hash differently", async () => {
    const [first, second] = await Promise.all([
      hashPassword(GOOD_PASSWORD),
      hashPassword(GOOD_PASSWORD),
    ]);

    expect(first).not.toEqual(second);
    await expect(verifyPassword(first, GOOD_PASSWORD)).resolves.toBe(true);
    await expect(verifyPassword(second, GOOD_PASSWORD)).resolves.toBe(true);
  });

  it("returns false instead of throwing for malformed stored hashes", async () => {
    await expect(verifyPassword("not-a-hash", GOOD_PASSWORD)).resolves.toBe(false);
    await expect(verifyPassword("", GOOD_PASSWORD)).resolves.toBe(false);
    await expect(verifyPassword(null, GOOD_PASSWORD)).resolves.toBe(false);
    await expect(verifyPassword(undefined, GOOD_PASSWORD)).resolves.toBe(false);
  });

  it("returns false for an empty password", async () => {
    const hash = await hashPassword(GOOD_PASSWORD);

    await expect(verifyPassword(hash, "")).resolves.toBe(false);
  });

  it("refuses to hash a password that violates the policy", async () => {
    await expect(hashPassword("short")).rejects.toBeInstanceOf(TypeError);
    await expect(hashPassword("           ")).rejects.toBeInstanceOf(TypeError);
    await expect(hashPassword("x".repeat(257))).rejects.toBeInstanceOf(TypeError);
  });

  it("reports no rehash for a hash produced with current parameters", async () => {
    const hash = await hashPassword(GOOD_PASSWORD);

    expect(needsRehash(hash)).toBe(false);
  });

  it("reports rehash for weaker parameters", async () => {
    const weak = await hashPassword(GOOD_PASSWORD, { memoryCost: 9_216, timeCost: 1 });

    expect(needsRehash(weak)).toBe(true);
  });

  it("reports rehash for a malformed or missing hash", () => {
    expect(needsRehash("garbage")).toBe(true);
    expect(needsRehash("")).toBe(true);
    expect(needsRehash(null)).toBe(true);
  });
});

describe("password policy", () => {
  it("accepts a compliant password", () => {
    expect(checkPasswordPolicy(GOOD_PASSWORD)).toBeNull();
    expect(checkPasswordPolicy("x".repeat(12))).toBeNull();
  });

  it("rejects short, blank, oversized, and non-string input", () => {
    expect(checkPasswordPolicy("short")).toMatch(/at least 12/);
    expect(checkPasswordPolicy("            ")).toMatch(/blank/);
    expect(checkPasswordPolicy("x".repeat(257))).toMatch(/at most 256/);
    expect(checkPasswordPolicy(undefined)).toMatch(/string/);
    expect(checkPasswordPolicy(12345)).toMatch(/string/);
  });
});