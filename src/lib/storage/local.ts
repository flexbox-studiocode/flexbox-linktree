import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  assertSafeStorageKey,
  type StorageObjectInput,
  type StorageProvider,
  type StorageReadResult,
  type StoredObject,
} from "./types";

const DEFAULT_ROOT = resolve(process.cwd(), ".local-storage", "uploads");

function contentTypeFor(key: string): string {
  const extension = key.split(".").pop()?.toLowerCase();
  return ({
    avif: "image/avif",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    ico: "image/x-icon",
  } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

export class LocalStorageAdapter implements StorageProvider {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(root = process.env.MEDIA_LOCAL_ROOT ? resolve(process.env.MEDIA_LOCAL_ROOT) : DEFAULT_ROOT) {
    this.root = root;
  }

  private path(key: string): string {
    return join(this.root, assertSafeStorageKey(key));
  }

  async upload(input: StorageObjectInput): Promise<StoredObject> {
    const key = assertSafeStorageKey(input.key);
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body, { flag: "wx", mode: 0o600 });
    return { key, sizeBytes: input.body.byteLength, contentType: input.contentType, publicUrl: this.getPublicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  getPublicUrl(key: string): string | null {
    const safeKey = assertSafeStorageKey(key);
    const base = process.env.MEDIA_LOCAL_PUBLIC_URL?.replace(/\/$/, "");
    return base ? `${base}/${safeKey.split("/").map(encodeURIComponent).join("/")}` : null;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await readFile(this.path(key));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async read(key: string): Promise<StorageReadResult | null> {
    try {
      const body = await readFile(this.path(key));
      return { body, contentType: contentTypeFor(key) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}
