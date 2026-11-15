import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  changeAdministratorStatus,
  deleteAdministrator,
} from "@/features/admin/services/admin-management";
import { hashPassword } from "@/lib/security/password";
import { deriveAccountBucket } from "@/lib/security/tokens";
import { openLocalDatabase, testSlug, type LocalDatabase } from "../helpers/db";

/**
 * Administrator management policy tests.
 *
 * Only the self-lockout rule, the deletion policy, and the lifecycle wiring are
 * exercised here. The last-active-Super-Admin rule needs a database with exactly
 * one active owner, which this shared local database deliberately does not have.
 */
const db: LocalDatabase | null = openLocalDatabase();

describe.skipIf(!db)("administrator management (local database)", () => {
  const prisma = db!.prisma;
  const createdAdminIds: string[] = [];
  let actorId: string;
  let actorEmail: string;
  let targetId: string;

  async function createAdmin(label: string, status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
    const normalizedEmail = `${testSlug(label)}@example.test`;
    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        fullName: `QA ${label}`,
        passwordHash: await hashPassword("integration-password-value"),
        role: "SUPER_ADMIN",
        status,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
      select: { id: true, normalizedEmail: true },
    });

    createdAdminIds.push(admin.id);

    return admin;
  }

  beforeAll(async () => {
    const actor = await createAdmin("management-actor");
    const target = await createAdmin("management-target");

    actorId = actor.id;
    actorEmail = actor.normalizedEmail;
    targetId = target.id;
  });

  afterAll(async () => {
    if (!db) return;

    await prisma.securityEvent.deleteMany({ where: { adminUserId: { in: createdAdminIds } } });
    await prisma.securityEvent.deleteMany({ where: { targetId: { in: createdAdminIds } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminIds } } });
    await db.dispose();
  });

  it("refuses to suspend the acting administrator", async () => {
    await expect(
      changeAdministratorStatus({
        actor: { adminId: actorId, actorEmail },
        adminUserId: actorId,
        nextStatus: "SUSPENDED",
      }),
    ).rejects.toMatchObject({ code: "self_lockout" });
  });

  it("refuses to disable the acting administrator", async () => {
    await expect(
      changeAdministratorStatus({
        actor: { adminId: actorId, actorEmail },
        adminUserId: actorId,
        nextStatus: "DISABLED",
      }),
    ).rejects.toMatchObject({ code: "self_lockout" });
  });

  it("suspends another administrator and increments authVersion", async () => {
    const before = await prisma.adminUser.findUniqueOrThrow({
      where: { id: targetId },
      select: { authVersion: true },
    });

    const result = await changeAdministratorStatus({
      actor: { adminId: actorId, actorEmail },
      adminUserId: targetId,
      nextStatus: "SUSPENDED",
    });

    expect(result.previousStatus).toBe("ACTIVE");
    expect(result.nextStatus).toBe("SUSPENDED");
    expect(result.authVersion).toBe(before.authVersion + 1);

    const event = await prisma.securityEvent.findFirst({
      where: { targetId, eventType: "ACCOUNT_SUSPENDED" },
      select: { eventType: true },
    });
    expect(event?.eventType).toBe("ACCOUNT_SUSPENDED");
  });

  it("reactivates a suspended administrator", async () => {
    const result = await changeAdministratorStatus({
      actor: { adminId: actorId, actorEmail },
      adminUserId: targetId,
      nextStatus: "ACTIVE",
    });

    expect(result.nextStatus).toBe("ACTIVE");
  });

  it("rejects an unknown administrator id", async () => {
    await expect(
      changeAdministratorStatus({
        actor: { adminId: actorId, actorEmail },
        adminUserId: "2b1f0f4c-0000-4000-8000-000000000000",
        nextStatus: "SUSPENDED",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  describe("permanent deletion", () => {
    it("refuses to delete the acting administrator", async () => {
      await expect(
        deleteAdministrator({
          actor: { adminId: actorId, actorEmail },
          adminUserId: actorId,
          confirmation: actorEmail,
        }),
      ).rejects.toMatchObject({ code: "self_lockout" });
    });

    it("rejects an actor that is not an active administrator", async () => {
      await expect(
        deleteAdministrator({
          actor: { adminId: "2b1f0f4c-0000-4000-8000-000000000000", actorEmail: "missing@example.test" },
          adminUserId: targetId,
          confirmation: "anything@example.test",
        }),
      ).rejects.toMatchObject({ code: "forbidden" });
    });

    it("requires the typed address to match the account", async () => {
      await expect(
        deleteAdministrator({
          actor: { adminId: actorId, actorEmail },
          adminUserId: targetId,
          confirmation: "someone-else@example.test",
        }),
      ).rejects.toMatchObject({ code: "invalid_input" });

      const stillThere = await prisma.adminUser.count({ where: { id: targetId } });
      expect(stillThere).toBe(1);
    });

    it("removes the account and revokes its credentials", async () => {
      const target = await prisma.adminUser.findUniqueOrThrow({
        where: { id: targetId },
        select: { normalizedEmail: true },
      });

      const invitation = await prisma.adminInvitation.create({
        data: {
          email: target.normalizedEmail,
          normalizedEmail: target.normalizedEmail,
          tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
          createdByAdminId: actorId,
        },
        select: { id: true },
      });

      await prisma.passwordResetToken.create({
        data: {
          adminUserId: targetId,
          tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
        },
      });

      await prisma.adminRateLimit.create({
        data: {
          scope: "ACCOUNT",
          keyHash: deriveAccountBucket(target.normalizedEmail),
          attemptCount: 3,
          windowStartedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
        },
      });

      const result = await deleteAdministrator({
        actor: { adminId: actorId, actorEmail },
        adminUserId: targetId,
        confirmation: target.normalizedEmail.toUpperCase(),
      });

      expect(result.adminUserId).toBe(targetId);
      expect(result.revokedInvitations).toBe(1);
      expect(result.removedResetTokens).toBe(1);
      expect(result.removedBuckets).toBe(1);

      expect(await prisma.adminUser.count({ where: { id: targetId } })).toBe(0);
      expect(await prisma.passwordResetToken.count({ where: { adminUserId: targetId } })).toBe(0);
      expect(
        await prisma.adminRateLimit.count({
          where: { scope: "ACCOUNT", keyHash: deriveAccountBucket(target.normalizedEmail) },
        }),
      ).toBe(0);

      const revoked = await prisma.adminInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
        select: { revokedAt: true },
      });
      expect(revoked.revokedAt).not.toBeNull();

      const audit = await prisma.securityEvent.findFirst({
        where: { eventType: "ADMIN_ACCOUNT_DELETED", targetId },
        select: { adminUserId: true, safeMetadata: true },
      });
      expect(audit?.adminUserId).toBe(actorId);
      expect(audit?.safeMetadata).toMatchObject({ accountEmail: target.normalizedEmail });

      await prisma.adminInvitation.deleteMany({ where: { id: invitation.id } });
    });

    it("rejects an unknown administrator id", async () => {
      await expect(
        deleteAdministrator({
          actor: { adminId: actorId, actorEmail },
          adminUserId: "2b1f0f4c-0000-4000-8000-000000000000",
          confirmation: "missing@example.test",
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });
});