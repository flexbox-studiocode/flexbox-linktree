import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { changeAdministratorStatus } from "@/features/admin/services/admin-management";
import { hashPassword } from "@/lib/security/password";
import { openLocalDatabase, testSlug, type LocalDatabase } from "../helpers/db";

/**
 * Administrator management policy tests.
 *
 * Only the self-lockout rule and the lifecycle wiring are exercised here. The
 * last-active-Super-Admin rule needs a database with exactly one active owner,
 * which this shared local database deliberately does not have.
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
});