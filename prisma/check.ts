import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Local connectivity check.
 *
 * Usage: pnpm db:check
 *
 * Writes and reads a single row in the local development database. It never
 * prints the connection string, and it refuses to run against a non-local host.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  const host = new URL(connectionString).hostname;

  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `Refusing to run the local connectivity check against a non-local host (${host}).`,
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const written = await prisma.systemCheck.upsert({
      where: { key: "foundation" },
      update: { note: "checked" },
      create: { key: "foundation", note: "checked" },
      select: { id: true, key: true, createdAt: true },
    });

    const total = await prisma.systemCheck.count();

    console.log("Database connectivity: OK");
    console.log(`  host: ${host}:${new URL(connectionString).port}`);
    console.log(`  wrote system_checks.key = ${written.key} (id ${written.id})`);
    console.log(`  system_checks rows = ${total}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Database connectivity check failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});