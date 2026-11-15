import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { AdminAccountStatus, AdminRole } from "@/generated/prisma/enums";

/**
 * Administrator account persistence.
 *
 * Only the columns needed for authentication and authorization are selected by
 * the lookups used on the hot path. `passwordHash` is fetched explicitly, never
 * by default, so it cannot leak into a DTO by accident.
 */

export const ADMIN_IDENTITY_SELECT = {
  id: true,
  email: true,
  normalizedEmail: true,
  fullName: true,
  role: true,
  status: true,
  authVersion: true,
} as const;

export type AdminIdentityRecord = {
  id: string;
  email: string;
  normalizedEmail: string;
  fullName: string;
  role: AdminRole;
  status: AdminAccountStatus;
  authVersion: number;
};

export async function findAdminById(id: string): Promise<AdminIdentityRecord | null> {
  return prisma.adminUser.findUnique({
    where: { id },
    select: ADMIN_IDENTITY_SELECT,
  });
}

export async function findByNormalizedEmail(
  normalizedEmail: string,
): Promise<AdminIdentityRecord | null> {
  return prisma.adminUser.findUnique({
    where: { normalizedEmail },
    select: ADMIN_IDENTITY_SELECT,
  });
}

export async function countActiveAdmins(): Promise<number> {
  return prisma.adminUser.count({ where: { status: "ACTIVE" } });
}

export async function countAdmins(): Promise<number> {
  return prisma.adminUser.count();
}

export type CreateInvitedAdminInput = {
  email: string;
  normalizedEmail: string;
  fullName: string;
  role?: AdminRole;
};

/**
 * Creates an administrator in the INVITED state with no usable password.
 * Attempting to create a second row for the same normalized email fails at the
 * database level (unique constraint), which is the intended race-safe behavior.
 */
export async function createInvitedAdmin(input: CreateInvitedAdminInput) {
  return prisma.adminUser.create({
    data: {
      email: input.email,
      normalizedEmail: input.normalizedEmail,
      fullName: input.fullName,
      role: input.role ?? "SUPER_ADMIN",
      status: "INVITED",
      passwordHash: null,
    },
    select: ADMIN_IDENTITY_SELECT,
  });
}

export type ActivateAdminInput = {
  adminUserId: string;
  passwordHash: string;
  fullName?: string;
};

/**
 * Activates an account and stores its first password. Increments `authVersion`
 * so any token issued before activation is rejected.
 */
export async function activateAdminWithPassword(input: ActivateAdminInput) {
  return prisma.adminUser.update({
    where: { id: input.adminUserId },
    data: {
      passwordHash: input.passwordHash,
      passwordChangedAt: new Date(),
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
      authVersion: { increment: 1 },
      ...(input.fullName ? { fullName: input.fullName } : {}),
    },
    select: ADMIN_IDENTITY_SELECT,
  });
}

/**
 * Replaces the password and revokes every existing session by incrementing
 * `authVersion`.
 */
export async function replaceAdminPassword(params: {
  adminUserId: string;
  passwordHash: string;
}) {
  return prisma.adminUser.update({
    where: { id: params.adminUserId },
    data: {
      passwordHash: params.passwordHash,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      authVersion: { increment: 1 },
    },
    select: ADMIN_IDENTITY_SELECT,
  });
}

/** Persists a rehash produced when the Argon2 parameters changed. */
export async function storeRehashedPassword(adminUserId: string, passwordHash: string) {
  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { passwordHash },
  });
}

export async function setAdminStatus(params: {
  adminUserId: string;
  status: AdminAccountStatus;
  revokeSessions: boolean;
}) {
  return prisma.adminUser.update({
    where: { id: params.adminUserId },
    data: {
      status: params.status,
      ...(params.revokeSessions ? { authVersion: { increment: 1 } } : {}),
      ...(params.status === "ACTIVE" ? { failedLoginCount: 0, lockedUntil: null } : {}),
    },
    select: ADMIN_IDENTITY_SELECT,
  });
}

/** Increments `authVersion` to revoke every outstanding JWT for the account. */
export async function revokeAdminSessions(adminUserId: string) {
  return prisma.adminUser.update({
    where: { id: adminUserId },
    data: { authVersion: { increment: 1 } },
    select: ADMIN_IDENTITY_SELECT,
  });
}

export async function recordSuccessfulLogin(adminUserId: string, at: Date = new Date()) {
  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { lastLoginAt: at, failedLoginCount: 0, lockedUntil: null },
  });
}

export async function recordFailedLoginForAdmin(adminUserId: string) {
  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { failedLoginCount: { increment: 1 } },
  });
}

/** Full record including the password hash. Only the credential path may use it. */
export async function findAdminWithPasswordHash(normalizedEmail: string) {
  return prisma.adminUser.findUnique({
    where: { normalizedEmail },
    select: { ...ADMIN_IDENTITY_SELECT, passwordHash: true },
  });
}
