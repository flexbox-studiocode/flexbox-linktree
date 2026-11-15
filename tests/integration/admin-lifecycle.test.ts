import { readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { openLocalDatabase, testSlug } from "../helpers/db";

/**
 * Account lifecycle and password-recovery integration tests.
 *
 * These drive the real database, the real Argon2id hashing, and the real
 * file-based mail transport. Nothing here touches an account it did not create.
 */
const database = openLocalDatabase();
const MAIL_DIRECTORY = resolve(process.cwd(), ".local-storage", "mail");

describe.skipIf(!database)("administrator account lifecycle (local database)", () => {
  const prisma = database!.prisma;
  const createdAdminIds: string[] = [];
  const createdEmails: string[] = [];
  const currentPassword = "lifecycle-current-password";
  const nextPassword = "lifecycle-replacement-password";

  function uniqueEmail(label: string): string {
    const email = `${testSlug(label)}@example.test`;
    createdEmails.push(email);

    return email;
  }

  async function createActiveAdmin(label: string, password = currentPassword) {
    const { hashPassword } = await import("@/lib/security/password");
    const normalizedEmail = uniqueEmail(label);

    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: `Lifecycle ${label}`,
        passwordHash: await hashPassword(password),
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
        authVersion: 1,
      },
      select: { id: true, normalizedEmail: true, authVersion: true },
    });

    createdAdminIds.push(admin.id);

    return admin;
  }

  /** Reads the recovery link that the file transport wrote for an address. */
  async function latestResetToken(email: string): Promise<string> {
    const entries = await readdir(MAIL_DIRECTORY).catch(() => [] as string[]);
    const matches = entries
      .filter((name) => name.includes("password_reset") && name.includes(email))
      .sort();

    expect(matches.length).toBeGreaterThan(0);

    const body = await readFile(join(MAIL_DIRECTORY, matches[matches.length - 1]), "utf8");
    const match = /token=([A-Za-z0-9_-]{32,})/.exec(body);

    expect(match).not.toBeNull();

    return match![1];
  }

  beforeAll(() => {
    process.env.ADMIN_MAIL_TRANSPORT = "file";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.RATE_LIMIT_SECRET = "lifecycle-test-rate-limit-secret";
  });

  afterAll(async () => {
    if (createdAdminIds.length > 0) {
      // Security events use SetNull; remove ours so the trail stays clean.
      await prisma.securityEvent.deleteMany({
        where: {
          OR: [
            { adminUserId: { in: createdAdminIds } },
            { targetId: { in: createdAdminIds } },
          ],
        },
      });
      await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminIds } } });
    }

    for (const email of createdEmails) {
      await prisma.adminRateLimit.deleteMany({
        where: { scope: "ACCOUNT", keyHash: (await import("@/lib/security/tokens")).deriveAccountBucket(email) },
      });

      const entries = await readdir(MAIL_DIRECTORY).catch(() => [] as string[]);

      for (const name of entries.filter((entry) => entry.includes(email))) {
        await rm(join(MAIL_DIRECTORY, name), { force: true });
      }
    }

    delete process.env.ADMIN_MAIL_TRANSPORT;
    delete process.env.RATE_LIMIT_SECRET;
    await database?.dispose();
  });

  it("changes the password only when the current password is re-presented", async () => {
    const { changeOwnPassword, LifecycleError } = await import(
      "@/features/auth/services/account-lifecycle"
    );
    const admin = await createActiveAdmin("change-wrong");

    await expect(
      changeOwnPassword({
        adminUserId: admin.id,
        currentPassword: "not-the-current-password",
        newPassword: nextPassword,
      }),
    ).rejects.toBeInstanceOf(LifecycleError);

    const updated = await changeOwnPassword({
      adminUserId: admin.id,
      currentPassword,
      newPassword: nextPassword,
    });

    expect(updated.authVersion).toBe(admin.authVersion + 1);

    const { verifyPassword } = await import("@/lib/security/password");
    const stored = await prisma.adminUser.findUniqueOrThrow({
      where: { id: admin.id },
      select: { passwordHash: true },
    });

    expect(await verifyPassword(stored.passwordHash, nextPassword)).toBe(true);
    expect(await verifyPassword(stored.passwordHash, currentPassword)).toBe(false);
  });

  it("rejects reusing the same password and a policy violation", async () => {
    const { changeOwnPassword, LifecycleError } = await import(
      "@/features/auth/services/account-lifecycle"
    );
    const admin = await createActiveAdmin("change-same");

    await expect(
      changeOwnPassword({
        adminUserId: admin.id,
        currentPassword,
        newPassword: currentPassword,
      }),
    ).rejects.toMatchObject({ code: "same_password" });

    await expect(
      changeOwnPassword({
        adminUserId: admin.id,
        currentPassword,
        newPassword: "short",
      }),
    ).rejects.toBeInstanceOf(LifecycleError);
  });

  it("revokes outstanding reset tokens when the password changes", async () => {
    const { requestPasswordReset, completePasswordReset, ResetError } = await import(
      "@/features/auth/services/password-reset"
    );
    const { changeOwnPassword } = await import("@/features/auth/services/account-lifecycle");
    const admin = await createActiveAdmin("reset-invalidated");

    await requestPasswordReset({ email: admin.normalizedEmail }, null);
    const token = await latestResetToken(admin.normalizedEmail);

    await changeOwnPassword({
      adminUserId: admin.id,
      currentPassword,
      newPassword: nextPassword,
    });

    await expect(
      completePasswordReset({ token, newPassword: "another-replacement-password" }),
    ).rejects.toBeInstanceOf(ResetError);
  });

  it("stores only a hash of the reset token and delivers a single-use link", async () => {
    const { requestPasswordReset, completePasswordReset } = await import(
      "@/features/auth/services/password-reset"
    );
    const { hashOpaqueToken } = await import("@/lib/security/tokens");
    const { verifyPassword } = await import("@/lib/security/password");
    const admin = await createActiveAdmin("reset-complete");
    const now = new Date();

    const outcome = await requestPasswordReset({ email: admin.normalizedEmail, now }, null);

    expect(outcome.status).toBe("accepted");

    const token = await latestResetToken(admin.normalizedEmail);
    const stored = await prisma.passwordResetToken.findMany({
      where: { adminUserId: admin.id },
      select: { tokenHash: true, usedAt: true },
    });

    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(hashOpaqueToken(token));
    expect(stored[0].tokenHash).not.toBe(token);
    expect(
      await prisma.passwordResetToken.count({ where: { tokenHash: token } }),
    ).toBe(0);

    const completed = await completePasswordReset({ token, newPassword: nextPassword, now });

    expect(completed.adminUserId).toBe(admin.id);

    const after = await prisma.adminUser.findUniqueOrThrow({
      where: { id: admin.id },
      select: { passwordHash: true, authVersion: true },
    });

    expect(await verifyPassword(after.passwordHash, nextPassword)).toBe(true);
    expect(after.authVersion).toBe(admin.authVersion + 1);

    // Replay is rejected.
    await expect(
      completePasswordReset({ token, newPassword: "yet-another-password-value", now }),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("rejects an expired reset token", async () => {
    const { requestPasswordReset, completePasswordReset, RESET_TOKEN_TTL_MINUTES } = await import(
      "@/features/auth/services/password-reset"
    );
    const admin = await createActiveAdmin("reset-expired");
    const now = new Date();

    await requestPasswordReset({ email: admin.normalizedEmail, now }, null);
    const token = await latestResetToken(admin.normalizedEmail);

    await expect(
      completePasswordReset({
        token,
        newPassword: nextPassword,
        now: new Date(now.getTime() + (RESET_TOKEN_TTL_MINUTES + 1) * 60 * 1_000),
      }),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("issues no token for a suspended account but answers identically", async () => {
    const { requestPasswordReset } = await import("@/features/auth/services/password-reset");
    const { suspendAdmin } = await import("@/features/auth/services/account-lifecycle");
    const admin = await createActiveAdmin("reset-suspended");

    await suspendAdmin({ adminUserId: admin.id });

    await expect(requestPasswordReset({ email: admin.normalizedEmail }, null)).resolves.toEqual({
      status: "accepted",
    });
    await expect(
      prisma.passwordResetToken.count({ where: { adminUserId: admin.id } }),
    ).resolves.toBe(0);
  });

  it("answers identically for an unknown address and creates no token", async () => {
    const { requestPasswordReset } = await import("@/features/auth/services/password-reset");
    const before = await prisma.passwordResetToken.count();

    await expect(
      requestPasswordReset({ email: uniqueEmail("reset-unknown") }, null),
    ).resolves.toEqual({ status: "accepted" });

    await expect(prisma.passwordResetToken.count()).resolves.toBe(before);
  });

  it("throttles repeated recovery requests from one source", async () => {
    const { requestPasswordReset, resetSourceBucket } = await import(
      "@/features/auth/services/password-reset"
    );
    const sourceHash = resetSourceBucket("198.51.100.77");
    const now = new Date();

    expect(sourceHash).not.toBeNull();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const outcome = await requestPasswordReset(
        { email: uniqueEmail(`throttle-${attempt}`), now },
        sourceHash,
      );

      expect(outcome.status).toBe("accepted");
    }

    const throttled = await requestPasswordReset(
      { email: uniqueEmail("throttle-final"), now },
      sourceHash,
    );

    expect(throttled.status).toBe("throttled");

    // The stored key must not contain the raw address.
    const bucket = await prisma.adminRateLimit.findFirstOrThrow({
      where: { scope: "SOURCE", keyHash: sourceHash! },
      select: { keyHash: true },
    });

    expect(bucket.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(bucket.keyHash).not.toContain("198.51.100.77");

    await prisma.adminRateLimit.deleteMany({ where: { keyHash: sourceHash! } });
  });

  it("suspends, disables, and reactivates an account with session revocation", async () => {
    const { suspendAdmin, disableAdmin, reactivateAdmin, LifecycleError } = await import(
      "@/features/auth/services/account-lifecycle"
    );
    const admin = await createActiveAdmin("status-flow");

    const suspended = await suspendAdmin({ adminUserId: admin.id });

    expect(suspended).toMatchObject({ previousStatus: "ACTIVE", nextStatus: "SUSPENDED" });
    expect(suspended.authVersion).toBe(admin.authVersion + 1);

    const disabled = await disableAdmin({ adminUserId: admin.id });

    expect(disabled).toMatchObject({ previousStatus: "SUSPENDED", nextStatus: "DISABLED" });

    // Repeating the same transition is rejected rather than silently no-op.
    await expect(disableAdmin({ adminUserId: admin.id })).rejects.toBeInstanceOf(LifecycleError);

    const reactivated = await reactivateAdmin({ adminUserId: admin.id });

    expect(reactivated).toMatchObject({ previousStatus: "DISABLED", nextStatus: "ACTIVE" });
    expect(reactivated.authVersion).toBeGreaterThan(disabled.authVersion);

    const events = await prisma.securityEvent.findMany({
      where: { targetId: admin.id },
      select: { eventType: true },
    });

    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["ACCOUNT_SUSPENDED", "ACCOUNT_DISABLED", "ACCOUNT_ACTIVATED"]),
    );
  });

  it("refuses to activate an account that never had a password", async () => {
    const { reactivateAdmin } = await import("@/features/auth/services/account-lifecycle");
    const normalizedEmail = uniqueEmail("no-password");

    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: "No Password",
        role: "SUPER_ADMIN",
        status: "SUSPENDED",
        authVersion: 1,
      },
      select: { id: true },
    });

    createdAdminIds.push(admin.id);

    await expect(reactivateAdmin({ adminUserId: admin.id })).rejects.toMatchObject({
      code: "invalid_transition",
    });
  });

  it("revokes sessions explicitly and records the event", async () => {
    const { revokeAdminSessionsForIdentity } = await import(
      "@/features/auth/services/account-lifecycle"
    );
    const admin = await createActiveAdmin("revoke");

    const result = await revokeAdminSessionsForIdentity({ adminUserId: admin.id });

    expect(result?.authVersion).toBe(admin.authVersion + 1);

    const event = await prisma.securityEvent.findFirst({
      where: { targetId: admin.id, eventType: "SESSION_REVOKED" },
    });

    expect(event).not.toBeNull();
  });

  it("writes the recovery mail only to the local transport", async () => {
    const { requestPasswordReset } = await import("@/features/auth/services/password-reset");
    const admin = await createActiveAdmin("mail-file");

    await requestPasswordReset({ email: admin.normalizedEmail }, null);

    const entries = await readdir(MAIL_DIRECTORY);
    const file = entries.find((name) => name.includes(admin.normalizedEmail));

    expect(file).toBeDefined();

    const payload = JSON.parse(await readFile(join(MAIL_DIRECTORY, file!), "utf8")) as {
      to: string;
      kind: string;
      body: string;
    };

    expect(payload.to).toBe(admin.normalizedEmail);
    expect(payload.kind).toBe("password_reset");
    expect(payload.body).toContain("/admin/reset-password?token=");
  });
});