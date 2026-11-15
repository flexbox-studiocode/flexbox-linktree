import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { AdminAccountStatus, AdminRole } from "@/generated/prisma/enums";

/**
 * Administrator management reads.
 *
 * These queries select only the columns the CMS needs. `passwordHash`,
 * `authVersion`, invitation token hashes, and reset token hashes are never
 * selected, so they cannot be rendered by accident.
 */

export type AdminAccountRow = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  status: AdminAccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  /** Latest invitation addressed to this account's address, or `null`. */
  invitation: {
    id: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  } | null;
};

export async function findAdminAccountRows(): Promise<AdminAccountRow[]> {
  const rows = await prisma.adminUser.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      fullName: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      passwordChangedAt: true,
    },
  });

  if (rows.length === 0) {
    return [];
  }

  // Invitations are addressed by email, not by a user foreign key, so the latest
  // invitation per normalized address is resolved in one additional query.
  const invitations = await prisma.adminInvitation.findMany({
    where: { normalizedEmail: { in: rows.map((row) => row.normalizedEmail) } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      normalizedEmail: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  const latestByEmail = new Map<string, AdminAccountRow["invitation"]>();

  for (const invitation of invitations) {
    if (!latestByEmail.has(invitation.normalizedEmail)) {
      latestByEmail.set(invitation.normalizedEmail, {
        id: invitation.id,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
      });
    }
  }

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
    passwordChangedAt: row.passwordChangedAt,
    invitation: latestByEmail.get(row.normalizedEmail) ?? null,
  }));
}

export type AdminStatusCounts = {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  disabled: number;
  superAdmins: number;
};

export async function getAdminStatusCounts(): Promise<AdminStatusCounts> {
  const [total, active, invited, suspended, disabled, superAdmins] = await Promise.all([
    prisma.adminUser.count(),
    prisma.adminUser.count({ where: { status: "ACTIVE" } }),
    prisma.adminUser.count({ where: { status: "INVITED" } }),
    prisma.adminUser.count({ where: { status: "SUSPENDED" } }),
    prisma.adminUser.count({ where: { status: "DISABLED" } }),
    prisma.adminUser.count({ where: { role: "SUPER_ADMIN" } }),
  ]);

  return { total, active, invited, suspended, disabled, superAdmins };
}

export async function findAdminSummaryById(id: string) {
  return prisma.adminUser.findUnique({
    where: { id },
    select: { id: true, fullName: true, email: true, status: true, role: true },
  });
}