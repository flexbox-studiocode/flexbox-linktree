import "server-only";

import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";
import type { StorageProvider } from "./types";

/**
 * Resolves the configured storage provider.
 *
 * `MEDIA_STORAGE_DRIVER` selects the backend. Local storage is the default so a
 * fresh clone works without cloud credentials. Production local storage is
 * supported only when an explicitly approved persistent absolute path is
 * configured; the deployment preflight enforces that contract.
 */
export function getStorageProvider(): StorageProvider {
  const driver = (process.env.MEDIA_STORAGE_DRIVER ?? (process.env.NODE_ENV === "production" ? "s3" : "local")).toLowerCase();

  if (driver === "s3") {
    return new S3StorageAdapter();
  }

  if (driver === "local") {
    if (process.env.NODE_ENV === "production") {
      if (process.env.MEDIA_ALLOW_LOCAL_IN_PRODUCTION !== "true") {
        throw new Error("Local media storage requires explicit persistent-storage approval in production.");
      }

      const root = process.env.MEDIA_LOCAL_ROOT?.trim();
      if (!root || !root.startsWith("/")) {
        throw new Error("Production local media storage requires an absolute MEDIA_LOCAL_ROOT.");
      }
    }

    return new LocalStorageAdapter();
  }

  throw new Error(`Unsupported MEDIA_STORAGE_DRIVER: ${driver}.`);
}

export * from "./types";
