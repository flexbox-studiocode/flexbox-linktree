import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { openLocalDatabase, testSlug } from "../helpers/db";

/**
 * Invitation lifecycle integration tests.
 *
 * These run only against the local development database. Every fixture uses a
 * unique email tenant, and cleanup removes only the records this file created.
 */
const database = openLocalDatabase();

describe.skipIf(!database)("invitation lifecycle (local database)", () => {
  const prisma = database!.prisma;
  const createdEmails: string[] = [];

  const password = "provisioning-test-pass-1";

  function uniqueEmail(label: string): string {
    const email = `${testSlug(label)}@example.test`;
    createdEmails.push(email);

    return email;
  }

  beforeAll(() => {
    process.env.ADMIN_BOOTSTRAP_ENABLED = "true";
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.adminUser.deleteMany({ where: { normalizedEmail: { in: createdEmails } } });
      await prisma.adminInvitation.deleteMany({ where: { normalizedEmail: { in: createdEmails } } });
    }

    delete process.env.ADMIN_BOOTSTRAP_ENABLED;
    await database?.dispose();
  });

  it("stores only the token hash and never the raw token", async () => {
    const { createInvitationForAdmin } = await import("@/features/auth/services/provisioning");
    const email = uniqueEmail("hash");

    const invitation = await createInvitationForAdmin({ email, fullName: "Hash Check" });
    const row = await prisma.adminInvitation.findUnique({
      where: { id: invitation.invitationId },
      select: { tokenHash: true },
    });

    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.tokenHash).not.toContain(invitation.token);

    const rawMatches = await prisma.adminInvitation.count({
      where: { tokenHash: invitation.token },
    });

    expect(rawMatches).toBe(0);
  });

  it("creates the administrator in the INVITED state with no password", async () => {
    const { createInvitationForAdmin } = await import("@/features/auth/services/provisioning");
    const email = uniqueEmail("invited");

    await createInvitationForAdmin({ email, fullName: "Invited Admin" });

    const admin = await prisma.adminUser.findUnique({
      where: { normalizedEmail: email },
      select: { status: true, passwordHash: true, role: true },
    });

    expect(admin?.status).toBe("INVITED");
    expect(admin?.passwordHash).toBeNull();
    expect(admin?.role).toBe("SUPER_ADMIN");
  });

  it("accepts a valid invitation and activates the account", async () => {
    const { createInvitationForAdmin, acceptInvitation } = await import(
      "@/features/auth/services/provisioning"
    );
    const email = uniqueEmail("valid");

    const invitation = await createInvitationForAdmin({ email, fullName: "Valid Admin" });
    const accepted = await acceptInvitation({ token: invitation.token, password });

    expect(accepted.normalizedEmail).toBe(email);

    const admin = await prisma.adminUser.findUnique({
      where: { normalizedEmail: email },
      select: { status: true, passwordHash: true, emailVerifiedAt: true, authVersion: true },
    });

    expect(admin?.status).toBe("ACTIVE");
    expect(admin?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(admin?.emailVerifiedAt).not.toBeNull();
    expect(admin?.authVersion).toBe(2);
  });

  it("rejects a replayed invitation token", async () => {
    const { createInvitationForAdmin, acceptInvitation, ProvisioningError } = await import(
      "@/features/auth/services/provisioning"
    );
    const email = uniqueEmail("replay");

    const invitation = await createInvitationForAdmin({ email, fullName: "Replay Admin" });

    await acceptInvitation({ token: invitation.token, password });

    await expect(acceptInvitation({ token: invitation.token, password: `${password}-2` }))
      .rejects.toBeInstanceOf(ProvisioningError);
  });

  it("rejects an expired invitation", async () => {
    const { createInvitationForAdmin, acceptInvitation, ProvisioningError } = await import(
      "@/features/auth/services/provisioning"
    );
    const email = uniqueEmail("expired");

    const invitation = await createInvitationForAdmin({ email, fullName: "Expired Admin" });

    await expect(
      acceptInvitation({
        token: invitation.token,
        password,
        now: new Date(invitation.expiresAt.getTime() + 1_000),
      }),
    ).rejects.toMatchObject({ code: "invalid_or_expired_invitation" });

    const admin = await prisma.adminUser.findUnique({
      where: { normalizedEmail: email },
      select: { status: true },
    });

    expect(admin?.status).toBe("INVITED");
    await expect(ProvisioningError).toBeTypeOf("function");
  });

  it("rejects a revoked invitation", async () => {
    const { createInvitationForAdmin, acceptInvitation, revokeInvitationById, ProvisioningError } =
      await import("@/features/auth/services/provisioning");
    const email = uniqueEmail("revoked");

    const invitation = await createInvitationForAdmin({ email, fullName: "Revoked Admin" });
    await revokeInvitationById({ invitationId: invitation.invitationId });

    await expect(acceptInvitation({ token: invitation.token, password })).rejects.toBeInstanceOf(
      ProvisioningError,
    );
  });

  it("rejects an unknown token without revealing whether an account exists", async () => {
    const { acceptInvitation } = await import("@/features/auth/services/provisioning");

    await expect(acceptInvitation({ token: "not-a-real-token", password })).rejects.toMatchObject({
      code: "invalid_or_expired_invitation",
    });
  });

  it("rejects a password that violates the policy", async () => {
    const { createInvitationForAdmin, acceptInvitation } = await import(
      "@/features/auth/services/provisioning"
    );
    const email = uniqueEmail("weak");

    const invitation = await createInvitationForAdmin({ email, fullName: "Weak Admin" });

    await expect(acceptInvitation({ token: invitation.token, password: "short" })).rejects.toMatchObject(
      { code: "invalid_password" },
    );
  });

  it("refuses to invite an email that already has an active account", async () => {
    const { createInvitationForAdmin, acceptInvitation } = await import(
      "@/features/auth/services/provisioning"
    );
    const email = uniqueEmail("duplicate");

    const invitation = await createInvitationForAdmin({ email, fullName: "Duplicate Admin" });
    await acceptInvitation({ token: invitation.token, password });

    await expect(
      createInvitationForAdmin({ email, fullName: "Duplicate Admin" }),
    ).rejects.toMatchObject({ code: "existing_account" });
  });

  it("revokes older pending invitations when a new one is issued", async () => {
    const { createInvitationForAdmin, acceptInvitation } = await import(
      "@/features/auth/services/provisioning"
    );
    const email = uniqueEmail("superseded");

    const first = await createInvitationForAdmin({ email, fullName: "Superseded Admin" });
    const second = await createInvitationForAdmin({ email, fullName: "Superseded Admin" });

    await expect(acceptInvitation({ token: first.token, password })).rejects.toMatchObject({
      code: "invalid_or_expired_invitation",
    });

    await expect(acceptInvitation({ token: second.token, password })).resolves.toMatchObject({
      normalizedEmail: email,
    });
  });

  it("records security events without any token or password material", async () => {
    const { createInvitationForAdmin, acceptInvitation } = await import(
      "@/features/auth/services/provisioning"
    );
    const email = uniqueEmail("events");

    const invitation = await createInvitationForAdmin({ email, fullName: "Events Admin" });
    await acceptInvitation({ token: invitation.token, password });

    const events = await prisma.securityEvent.findMany({
      where: { adminUserId: (await prisma.adminUser.findUniqueOrThrow({ where: { normalizedEmail: email } })).id },
      select: { eventType: true, safeMetadata: true },
    });

    const serialized = JSON.stringify(events);

    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["INVITATION_ACCEPTED", "ACCOUNT_ACTIVATED"]),
    );
    expect(serialized).not.toContain(invitation.token);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain("$argon2id$");
  });

  it("never allows a second bootstrap once an administrator exists", async () => {
    const { bootstrapFirstSuperAdmin } = await import("@/features/auth/services/provisioning");

    await expect(
      bootstrapFirstSuperAdmin({
        email: uniqueEmail("bootstrap"),
        fullName: "Bootstrap Attempt",
        password,
      }),
    ).rejects.toMatchObject({ code: "existing_account" });
  });

  it("refuses bootstrap when the environment gate is not set", async () => {
    const { bootstrapFirstSuperAdmin } = await import("@/features/auth/services/provisioning");

    delete process.env.ADMIN_BOOTSTRAP_ENABLED;

    await expect(
      bootstrapFirstSuperAdmin({
        email: uniqueEmail("gate"),
        fullName: "Gate Attempt",
        password,
      }),
    ).rejects.toMatchObject({ code: "bootstrap_disabled" });
  });
});