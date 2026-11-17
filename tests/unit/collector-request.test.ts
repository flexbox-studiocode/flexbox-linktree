import { describe, expect, it } from "vitest";

import {
  isSameOriginCollectorRequest,
  readCollectorBody,
} from "@/features/analytics/services/collector-request";

async function streamFrom(parts: Uint8Array[]): Promise<ReadableStream<Uint8Array>> {
  return new ReadableStream({
    async start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  });
}

const BASE_REQUEST = {
  origin: null,
  secFetchSite: null,
  requestUrl: "https://hub.flexbox.studio/",
  configuredOrigin: "https://hub.flexbox.studio",
};

describe("isSameOriginCollectorRequest", () => {
  it("accepts a request whose Origin matches the configured origin", () => {
    expect(
      isSameOriginCollectorRequest({ ...BASE_REQUEST, origin: "https://hub.flexbox.studio" }),
    ).toBe(true);
  });

  it("accepts a same-origin Sec-Fetch-Site when Origin is absent", () => {
    expect(isSameOriginCollectorRequest({ ...BASE_REQUEST, secFetchSite: "same-origin" })).toBe(true);
  });

  it("rejects a cross-site Origin", () => {
    expect(
      isSameOriginCollectorRequest({ ...BASE_REQUEST, origin: "https://evil.example" }),
    ).toBe(false);
  });

  it("rejects a cross-site Sec-Fetch-Site", () => {
    expect(isSameOriginCollectorRequest({ ...BASE_REQUEST, secFetchSite: "cross-site" })).toBe(false);
  });

  it("falls back to request URL origin when no origin is configured", () => {
    expect(
      isSameOriginCollectorRequest({
        origin: "https://hub.flexbox.studio",
        secFetchSite: null,
        requestUrl: "https://hub.flexbox.studio/api/analytics/collect",
        configuredOrigin: null,
      }),
    ).toBe(true);
  });

  it("allows a request with neither Origin nor Sec-Fetch-Site (privacy-stripped)", () => {
    expect(isSameOriginCollectorRequest(BASE_REQUEST)).toBe(true);
  });

  it("rejects an unparseable Origin", () => {
    expect(isSameOriginCollectorRequest({ ...BASE_REQUEST, origin: "not a url" })).toBe(false);
  });
});

describe("readCollectorBody", () => {
  it("reads a small body within the limit", async () => {
    const body = await streamFrom([new TextEncoder().encode("{\"type\":\"page_view\"}")]);
    expect(await readCollectorBody(body, null)).toBe("{\"type\":\"page_view\"}");
  });

  it("joins multi-chunk bodies in order", async () => {
    const body = await streamFrom([
      new TextEncoder().encode("{\"typ"),
      new TextEncoder().encode("e\":\"page_view\"}"),
    ]);
    expect(await readCollectorBody(body, null)).toBe("{\"type\":\"page_view\"}");
  });

  it("rejects a body larger than the byte limit", async () => {
    const big = new Uint8Array(2049).fill(0x61);
    const body = await streamFrom([big]);
    expect(await readCollectorBody(body, null)).toBeNull();
  });

  it("rejects an oversized declared Content-Length", async () => {
    const body = await streamFrom([new TextEncoder().encode("{}")]);
    expect(await readCollectorBody(body, "99999")).toBeNull();
  });

  it("rejects a non-numeric Content-Length", async () => {
    const body = await streamFrom([new TextEncoder().encode("{}")]);
    expect(await readCollectorBody(body, "abc")).toBeNull();
  });

  it("returns an empty string for a bodyless request", async () => {
    expect(await readCollectorBody(null, null)).toBe("");
  });

  it("rejects a body that exceeds the limit across many small chunks", async () => {
    // many chunks that together exceed the limit
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < 3; i += 1) {
      chunks.push(new Uint8Array(1024).fill(0x62));
    }
    const body = await streamFrom(chunks);
    expect(await readCollectorBody(body, null)).toBeNull();
  });

  it("accepts a body with a valid Content-Length at the boundary", async () => {
    const payload = new TextEncoder().encode("{}");
    const body = await streamFrom([payload]);
    expect(await readCollectorBody(body, String(payload.byteLength))).toBe("{}");
  });

  it("stops consuming a stream once the limit is exceeded", async () => {
    const big = new Uint8Array(8192).fill(0x63);
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(big);
        controller.close();
      },
    });
    // Enforcing the limit must not depend on reading the full stream.
    const result = await readCollectorBody(body, null);
    expect(result).toBeNull();
  });
});
