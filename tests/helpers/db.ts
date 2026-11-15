import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type LocalDatabase = {
  prisma: PrismaClient;
  dispose: () => Promise<void>;
};

/**
 * Opens a database handle for integration tests, but only when `DATABASE_URL`
 * points at a local host. Integration tests are additive (they create records
 * with unique slugs and delete only those records), and they refuse to touch a
 * non-local database so they can never run against staging or production.
 */
export function openLocalDatabase(): LocalDatabase | null {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return null;
  }

  let host: string;

  try {
    host = new URL(connectionString).hostname;
  } catch {
    return null;
  }

  if (!LOCAL_HOSTS.has(host)) {
    return null;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  return {
    prisma,
    dispose: async () => {
      await prisma.$disconnect();
    },
  };
}

/** Creates a unique, obviously-temporary slug so tests never collide. */
export function testSlug(label: string): string {
  return `test-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
