import { describe, expect, it } from "vitest";

import {
  deriveAccountBucket,
  deriveSourceBucket,
  generateOpaqueToken,
  hashOpaqueToken,
  safeEqualHex,
  TOKEN_BYTES,
} from "@/lib/security/tokens";

describe("opaque security tokens", () => {
  it("generates unique URL-safe tokens with 256 bits of entropy", () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(first, "base64url")).toHaveLength(TOKEN_BYTES);
  });

  it("refuses insufficient token entropy", () => {
    expect(() => generateOpaqueToken(15)).toThrow(/128 bits/);
  });

  it("stores a SHA-256 hash rather than the raw token", () => {
    const token = generateOpaqueToken();
    const hash = hashOpaqueToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hash).toBe(hashOpaqueToken(token));
  });

  it("compares token hashes safely", () => {
    const hash = hashOpaqueToken("same token");

    expect(safeEqualHex(hash, hashOpaqueToken("same token"))).toBe(true);
    expect(safeEqualHex(hash, hashOpaqueToken("different token"))).toBe(false);
    expect(safeEqualHex(hash, "short")).toBe(false);
  });
});

describe("privacy-preserving rate-limit bucket keys", () => {
  it("uses a stable SHA-256 account bucket", () => {
    expect(deriveAccountBucket("admin@flexbox.test")).toBe(
      deriveAccountBucket("admin@flexbox.test"),
    );
    expect(deriveAccountBucket("admin@flexbox.test")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses a keyed HMAC for source buckets", () => {
    const first = deriveSourceBucket("127.0.0.1", "test-key-one");
    const second = deriveSourceBucket("127.0.0.1", "test-key-one");
    const otherKey = deriveSourceBucket("127.0.0.1", "test-key-two");

    expect(first).toBe(second);
    expect(first).not.toBe(otherKey);
    expect(first).not.toContain("127.0.0.1");
  });

  it("requires a dedicated source-bucket secret", () => {
    expect(() => deriveSourceBucket("127.0.0.1", "")).toThrow(/secret/);
  });
});