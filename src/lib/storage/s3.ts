import "server-only";

import { createHmac, createHash } from "node:crypto";

import {
  assertSafeStorageKey,
  type StorageObjectInput,
  type StorageProvider,
  type StorageReadResult,
  type StoredObject,
} from "./types";

function hmac(key: Uint8Array | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function encodePath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export class S3StorageAdapter implements StorageProvider {
  readonly name = "s3" as const;
  private readonly bucket = this.required("S3_BUCKET");
  private readonly region = process.env.S3_REGION ?? "us-east-1";
  private readonly endpoint = (process.env.S3_ENDPOINT ?? `https://s3.${this.region}.amazonaws.com`).replace(/\/$/, "");
  private readonly accessKey = this.required("S3_ACCESS_KEY_ID");
  private readonly secretKey = this.required("S3_SECRET_ACCESS_KEY");

  private required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for S3 storage.`);
    return value;
  }

  private url(key: string): string {
    return `${this.endpoint}/${encodeURIComponent(this.bucket)}/${encodePath(assertSafeStorageKey(key))}`;
  }

  private async request(method: string, key: string, body?: Uint8Array, contentType?: string): Promise<Response> {
    const safeKey = assertSafeStorageKey(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256(body ?? new Uint8Array());
    const host = new URL(this.url(safeKey)).host;
    const canonicalUri = new URL(this.url(safeKey)).pathname;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const scope = `${date}/${this.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.secretKey}`, date), this.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const headers: Record<string, string> = {
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (contentType) headers["Content-Type"] = contentType;
    return fetch(this.url(safeKey), { method, headers, body: body ? Buffer.from(body) : undefined });
  }

  async upload(input: StorageObjectInput): Promise<StoredObject> {
    const response = await this.request("PUT", input.key, input.body, input.contentType);
    if (!response.ok) throw new Error(`S3 upload failed with HTTP ${response.status}.`);
    return { key: assertSafeStorageKey(input.key), sizeBytes: input.body.byteLength, contentType: input.contentType, publicUrl: this.getPublicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    const response = await this.request("DELETE", key);
    if (!response.ok && response.status !== 404) throw new Error(`S3 delete failed with HTTP ${response.status}.`);
  }

  getPublicUrl(key: string): string | null {
    return process.env.S3_PUBLIC_URL ? `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/${encodePath(assertSafeStorageKey(key))}` : null;
  }

  async exists(key: string): Promise<boolean> {
    const response = await this.request("HEAD", key);
    return response.ok;
  }

  async read(key: string): Promise<StorageReadResult | null> {
    const response = await this.request("GET", key);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`S3 read failed with HTTP ${response.status}.`);
    return { body: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "application/octet-stream" };
  }
}
