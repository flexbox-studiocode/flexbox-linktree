import "server-only";

import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";
import type { StorageProvider } from "./types";

/**
 * Resolves the configured storage provider.
 *
 * `MEDIA_STORAGE_DRIVER` selects the backend. Local storage is the default so a
 * fresh clone works without cloud credentials; production must set `s3` and the
 * matching `S3_*` variables so media is not written into an ephemeral
 * application container.
 */
export function getStorageProvider(): StorageProvider {
  const driver = (process.env.MEDIA_STORAGE_DRIVER ?? (process.env.NODE_ENV === "production" ? "s3" : "local")).toLowerCase();

  if (driver === "s3") {
    return new S3StorageAdapter();
  }

  if (driver === "local") {
    if (process.env.NODE_ENV === "production" && process.env.MEDIA_ALLOW_LOCAL_IN_PRODUCTION !== "true") {
      throw new Error("Local media storage is disabled in production. Configure MEDIA_STORAGE_DRIVER=s3.");
    }

    return new LocalStorageAdapter();
  }

  throw new Error(`Unsupported MEDIA_STORAGE_DRIVER: ${driver}.`);
}

export * from "./types";