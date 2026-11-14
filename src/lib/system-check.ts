import { prisma } from "@/lib/prisma/client";

/**
 * Records a heartbeat row and reads it back.
 *
 * This is deliberately small: it proves the schema, the migration, the
 * Prisma client, and the local PostgreSQL connection all work together.
 */
export async function runSystemCheck(key = "foundation"): Promise<{
  id: string;
  key: string;
  createdAt: Date;
}> {
  const record = await prisma.systemCheck.upsert({
    where: { key },
    update: { note: "checked" },
    create: { key, note: "checked" },
    select: { id: true, key: true, createdAt: true },
  });

  return record;
}

export async function countSystemChecks(): Promise<number> {
  return prisma.systemCheck.count();
}