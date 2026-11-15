import { afterAll, describe, expect, it } from "vitest";

import { openLocalDatabase, testSlug } from "../helpers/db";

/**
 * Authorization integration tests.
 *
 * Every case proves that rights are derived from the database row, not from the
 * token payload: a well-formed `sub`/`av` pair is rejected as soon as the account
 * is suspended, disabled, missing, or its `authVersion` has moved.
 */
const database = openLocalDatabase();

describe.skipIf(!database)("administrator authorization (local database)", () => {
  const prisma = database!.prisma;
  const createdAdminIds: string[] = [];

  async function createAdmin(fields: {
    status?: "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED";
    authVersion?: number;
  } = {}) {
    const { hashPassword } = await import("@/lib/security/password");
    const normalizedEmail = `${testSlug("authz")}@example.test`;

    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: "Authorization Test",
        passwordHash: fields.status === "INVITED" ? null : await hashPassword("authorization-test-pass"),
        role: "SUPER_ADMIN",
        status: fields.status ?? "ACTIVE",
        authVersion: fields.authVersion ?? 1,
      },
      select: { id: true, authVersion: true },
    });

    createdAdminIds.push(admin.id);

    return admin;
  }

  afterAll(async () => {
    if (createdAdminIds.length > 0) {
      await prisma.securityEvent.deleteMany({ where: { adminUserId: { in: createdAdminIds } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminIds } } });
    }

    await database?.dispose();
  });

  it("authorizes an ACTIVE super admin with the current authVersion", async () => {
    const { resolveAuthorizedAdmin } = await import("@/features/auth/services/authorization");
    const admin = await createAdmin();

    await expect(
      resolveAuthorizedAdmin({ sub: admin.id, av: admin.authVersion }),
    ).resolves.toMatchObject({
      id: admin.id,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    });
  });

  it("rejects a missing or malformed token payload", async () => {
    const { resolveAuthorizedAdmin } = await import("@/features/auth/services/authorization");

    await expect(resolveAuthorizedAdmin(null)).resolves.toBeNull();
    await expect(resolveAuthorizedAdmin({})).resolves.toBeNull();
    await expect(resolveAuthorizedAdmin({ sub: null, av: 1 })).resolves.toBeNull();
    await expect(resolveAuthorizedAdmin({ sub: "admin", av: null })).resolves.toBeNull();
    await expect(resolveAuthorizedAdmin({ sub: "admin", av: "1" as unknown as number })).resolves.toBeNull();
  });

  it("rejects an unknown administrator id", async () => {
    const { resolveAuthorizedAdmin } = await import("@/features/auth/services/authorization");

    await expect(
      resolveAuthorizedAdmin({ sub: "00000000-0000-4000-8000-000000000000", av: 1 }),
    ).resolves.toBeNull();
  });

  for (const status of ["INVITED", "SUSPENDED", "DISABLED"] as const) {
    it(`rejects a ${status} account even with valid claims`, async () => {
      const { resolveAuthorizedAdmin } = await import("@/features/auth/services/authorization");
      const admin = await createAdmin({ status });

      await expect(
        resolveAuthorizedAdmin({ sub: admin.id, av: admin.authVersion }),
      ).resolves.toBeNull();
    });
  }

  it("rejects a token whose authVersion is stale", async () => {
    const { resolveAuthorizedAdmin } = await import("@/features/auth/services/authorization");
    const { revokeAdminSessions } = await import("@/features/auth/repositories/admin-user");
    const admin = await createAdmin();
    const staleVersion = admin.authVersion;

    await revokeAdminSessions(admin.id);

    await expect(
      resolveAuthorizedAdmin({ sub: admin.id, av: staleVersion }),
    ).resolves.toBeNull();

    await expect(
      resolveAuthorizedAdmin({ sub: admin.id, av: staleVersion + 1 }),
    ).resolves.toMatchObject({ id: admin.id });
  });

  it("stops authorizing as soon as the account is suspended", async () => {
    const { resolveAuthorizedAdmin } = await import("@/features/auth/services/authorization");
    const { setAdminStatus } = await import("@/features/auth/repositories/admin-user");
    const admin = await createAdmin();

    await expect(
      resolveAuthorizedAdmin({ sub: admin.id, av: admin.authVersion }),
    ).resolves.toMatchObject({ id: admin.id });

    const suspended = await setAdminStatus({
      adminUserId: admin.id,
      status: "SUSPENDED",
      revokeSessions: true,
    });

    // Both the status change and the incremented generation deny access.
    await expect(
      resolveAuthorizedAdmin({ sub: admin.id, av: admin.authVersion }),
    ).resolves.toBeNull();
    await expect(
      resolveAuthorizedAdmin({ sub: admin.id, av: suspended.authVersion }),
    ).resolves.toBeNull();
  });

  it("exposes no server-only field in the session DTO", async () => {
    const { resolveAuthorizedAdmin, toAdminSession } = await import(
      "@/features/auth/services/authorization"
    );
    const admin = await createAdmin();

    const identity = await prisma.adminUser.findUniqueOrThrow({
      where: { id: admin.id },
      select: { id: true, email: true, fullName: true, role: true },
    });

    const authorized = await resolveAuthorizedAdmin({ sub: admin.id, av: admin.authVersion });
    const dto = toAdminSession(identity);
    const serialized = JSON.stringify(dto);

    expect(authorized?.id).toBe(identity.id);

    expect(Object.keys(dto).sort()).toEqual(["email", "id", "isSuperAdmin", "name", "role"]);
    expect(serialized).not.toContain("argon2");
    expect(serialized).not.toContain("authVersion");
    expect(serialized).not.toContain("normalizedEmail");
    expect(serialized).not.toContain("passwordHash");
  });

  it("reports assertAdminActive/assertSuperAdmin consistently", async () => {
    const { assertAdminActive, assertSuperAdmin, AuthorizationError } = await import(
      "@/features/auth/services/authorization"
    );
    const admin = await createAdmin();

    await expect(assertAdminActive({ sub: admin.id, av: admin.authVersion })).resolves.toBe(true);
    await expect(assertAdminActive({ sub: admin.id, av: 999 })).resolves.toBe(false);
    await expect(assertSuperAdmin({ sub: admin.id, av: admin.authVersion })).resolves.toMatchObject({
      id: admin.id,
    });
    await expect(assertSuperAdmin({ sub: admin.id, av: 999 })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});
