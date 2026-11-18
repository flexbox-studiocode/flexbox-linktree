import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma/client";
import { getStorageProvider } from "@/lib/storage";

type CheckState = "ok" | "error";

async function checkDatabase(): Promise<CheckState> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkStorage(): Promise<CheckState> {
  try {
    const provider = getStorageProvider();

    if (provider.name === "local") {
      const root = resolve(/* turbopackIgnore: true */ process.env.MEDIA_LOCAL_ROOT ?? ".local-storage/uploads");
      await access(root, constants.R_OK | constants.W_OK);
    }

    return "ok";
  } catch {
    return "error";
  }
}

export async function GET() {
  const [database, storage] = await Promise.all([checkDatabase(), checkStorage()]);
  const healthy = database === "ok" && storage === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "error",
      checks: { database, storage },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
