import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { openLocalDatabase, testSlug } from "../helpers/db";

/**
 * Credential-verification integration tests.
 *
 * These exercise the real Argon2id hashing and the real PostgreSQL-backed
 * throttle. They refuse to run against a non-local database (see
 * `openLocalDatabase`) and clean up only the rows they create.
 */
const database = openLocalDatabase();

describe.skipIf(!database)("administrator authentication (local database)", () => {
  const prisma = database!.prisma;
  const createdAdminIds: string[] = [];
  const createdEmails: string[] = [];
  const password = "correct-horse-battery-staple";

  const RATE_LIMIT_SECRET = "integration-test-rate-limit-secret";

  function uniqueEmail(label: string): string {
    const email = `${testSlug(label)}@example.test`;
    createdEmails.push(email);

    return email;
  }

  async function createActiveAdmin(label: string, plaintext = password) {
    const { hashPassword } = await import("@/lib/security/password");
    const normalizedEmail = uniqueEmail(label);

    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: `Auth Test ${label}`,
        passwordHash: await hashPassword(plaintext),
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
        authVersion: 1,
      },
      select: { id: true, normalizedEmail: true },
    });

    createdAdminIds.push(admin.id);

    return admin;
  }

  beforeAll(() => {
    process.env.RATE_LIMIT_SECRET = RATE_LIMIT_SECRET;
  });

  afterAll(async () => {
    if (createdAdminIds.length > 0) {
      // Security events use SetNull on delete; remove them so the audit trail
      // does not accumulate orphaned test rows.
      await prisma.securityEvent.deleteMany({ where: { adminUserId: { in: createdAdminIds } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminIds } } });
    }

    for (const email of createdEmails) {
      await prisma.adminRateLimit.deleteMany({
        where: { scope: "ACCOUNT", keyHash: (await import("@/lib/security/tokens")).deriveAccountBucket(email) },
      });
    }

    await prisma.adminRateLimit.deleteMany({
      where: {
        scope: "SOURCE",
        keyHash: (await import("@/lib/security/tokens")).deriveSourceBucket("203.0.113.10", RATE_LIMIT_SECRET),
      },
    });
    await prisma.adminRateLimit.deleteMany({
      where: {
        scope: "SOURCE",
        keyHash: (await import("@/lib/security/tokens")).deriveSourceBucket("203.0.113.20", RATE_LIMIT_SECRET),
      },
    });

    delete process.env.RATE_LIMIT_SECRET;
    await database?.dispose();
  });

  it("accepts a correct password and returns the session identity", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const admin = await createActiveAdmin("success");

    const authenticated = await authenticateAdmin({
      email: admin.normalizedEmail,
      password,
    });

    expect(authenticated).toEqual({
      id: admin.id,
      role: "SUPER_ADMIN",
      authVersion: 1,
    });

    const stored = await prisma.adminUser.findUniqueOrThrow({
      where: { id: admin.id },
      select: { lastLoginAt: true },
    });

    expect(stored.lastLoginAt).not.toBeNull();
  });

  it("rejects a wrong password without revealing whether the account exists", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const admin = await createActiveAdmin("wrong-password");

    await expect(
      authenticateAdmin({ email: admin.normalizedEmail, password: "definitely-wrong" }),
    ).resolves.toBeNull();

    await expect(
      authenticateAdmin({ email: uniqueEmail("does-not-exist"), password }),
    ).resolves.toBeNull();
  });

  it("never records the raw password, hash, or email key in the throttle table", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const { deriveAccountBucket } = await import("@/lib/security/tokens");
    const admin = await createActiveAdmin("bucket-shape");

    await authenticateAdmin({ email: admin.normalizedEmail, password: "wrong-1" });
    await authenticateAdmin({ email: admin.normalizedEmail, password: "wrong-2" });

    const bucket = await prisma.adminRateLimit.findUniqueOrThrow({
      where: { scope_keyHash: { scope: "ACCOUNT", keyHash: deriveAccountBucket(admin.normalizedEmail) } },
    });

    expect(bucket.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(bucket.keyHash).not.toContain("@");
    expect(bucket.keyHash).not.toContain(admin.normalizedEmail);
    expect(bucket.attemptCount).toBe(2);
  });

  it("locks the account bucket after five failures and records LOGIN_BLOCKED", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const { checkLoginAllowed } = await import("@/features/auth/services/rate-limit");
    const admin = await createActiveAdmin("lockout");
    const now = new Date();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        authenticateAdmin({ email: admin.normalizedEmail, password: "wrong", now }),
      ).resolves.toBeNull();
    }

    const decision = await checkLoginAllowed({
      normalizedEmail: admin.normalizedEmail,
      sourceBucketKey: null,
      now,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);

    // Even the correct password is refused while the bucket is locked.
    await expect(
      authenticateAdmin({ email: admin.normalizedEmail, password, now }),
    ).resolves.toBeNull();

    const blocked = await prisma.securityEvent.count({
      where: { eventType: "LOGIN_BLOCKED" },
    });

    expect(blocked).toBeGreaterThan(0);
  });

  it("clears the account bucket after a successful sign-in", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const { checkLoginAllowed } = await import("@/features/auth/services/rate-limit");
    const { deriveAccountBucket } = await import("@/lib/security/tokens");
    const admin = await createActiveAdmin("reset");
    const now = new Date();

    await authenticateAdmin({ email: admin.normalizedEmail, password: "wrong-1", now });
    await authenticateAdmin({ email: admin.normalizedEmail, password: "wrong-2", now });

    await expect(
      authenticateAdmin({ email: admin.normalizedEmail, password, now }),
    ).resolves.toMatchObject({ id: admin.id });

    const bucket = await prisma.adminRateLimit.findUnique({
      where: { scope_keyHash: { scope: "ACCOUNT", keyHash: deriveAccountBucket(admin.normalizedEmail) } },
    });

    expect(bucket).toBeNull();

    const decision = await checkLoginAllowed({
      normalizedEmail: admin.normalizedEmail,
      sourceBucketKey: null,
      now,
    });

    expect(decision.allowed).toBe(true);
  });

  it("rejects accounts that are not ACTIVE", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const { hashPassword } = await import("@/lib/security/password");

    for (const status of ["INVITED", "SUSPENDED", "DISABLED"] as const) {
      const normalizedEmail = uniqueEmail(`status-${status.toLowerCase()}`);
      const admin = await prisma.adminUser.create({
        data: {
          email: normalizedEmail,
          normalizedEmail,
          fullName: `Status ${status}`,
          passwordHash: status === "INVITED" ? null : await hashPassword(password),
          role: "SUPER_ADMIN",
          status,
          authVersion: 1,
        },
        select: { id: true },
      });

      createdAdminIds.push(admin.id);

      await expect(
        authenticateAdmin({ email: normalizedEmail, password }),
      ).resolves.toBeNull();
    }
  });

  it("rehashes a stored password that uses weaker parameters", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const { hashPassword, needsRehash } = await import("@/lib/security/password");
    const normalizedEmail = uniqueEmail("rehash");

    const weakHash = await hashPassword(password, { memoryCost: 8_192, timeCost: 1 });

    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: "Rehash Admin",
        passwordHash: weakHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        authVersion: 1,
      },
      select: { id: true },
    });

    createdAdminIds.push(admin.id);

    await expect(authenticateAdmin({ email: normalizedEmail, password })).resolves.toMatchObject({
      id: admin.id,
    });

    const updated = await prisma.adminUser.findUniqueOrThrow({
      where: { id: admin.id },
      select: { passwordHash: true },
    });

    expect(updated.passwordHash).not.toBe(weakHash);
    expect(needsRehash(updated.passwordHash)).toBe(false);
  });

  it("blocks a source bucket shared across accounts after twenty failures", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const { checkLoginAllowed, sourceBucketKey } = await import("@/features/auth/services/rate-limit");
    const now = new Date();
    const source = "203.0.113.10";

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await authenticateAdmin({
        email: uniqueEmail(`source-${attempt}`),
        password: "wrong",
        sourceIdentifier: source,
        now,
      });
    }

    const decision = await checkLoginAllowed({
      normalizedEmail: uniqueEmail("source-victim"),
      sourceBucketKey: sourceBucketKey({ sourceIdentifier: source }, RATE_LIMIT_SECRET),
      now,
    });

    expect(decision.allowed).toBe(false);

    const stored = await prisma.adminRateLimit.findUnique({
      where: {
        scope_keyHash: {
          scope: "SOURCE",
          keyHash: sourceBucketKey({ sourceIdentifier: source }, RATE_LIMIT_SECRET)!,
        },
      },
      select: { keyHash: true },
    });

    expect(stored?.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.keyHash).not.toContain(source);
  });

  it("records a successful login event without any credential material", async () => {
    const { authenticateAdmin } = await import("@/features/auth/services/authenticate-admin");
    const admin = await createActiveAdmin("event-success");

    await authenticateAdmin({ email: admin.normalizedEmail, password });

    const events = await prisma.securityEvent.findMany({
      where: { adminUserId: admin.id },
      select: { eventType: true, safeMetadata: true },
    });
    const serialized = JSON.stringify(events);

    expect(events.map((event) => event.eventType)).toContain("LOGIN_SUCCEEDED");
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain("$argon2id$");
    expect(serialized).not.toContain("$argon2");
  });
});
