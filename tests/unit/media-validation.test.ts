import { describe, expect, it } from "vitest";

import {
  MAX_MEDIA_BYTES,
  MediaValidationError,
  sanitizeOriginalName,
  sniffImageType,
  validateMediaUpload,
} from "@/features/media/validation";

/** Minimal byte fixtures: enough header bytes for the sniffer. */
function png(width = 2, height = 3): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function jpeg(width = 640, height = 480): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0xff, 0xd8, 0xff], 0);
  // SOF0 marker with length 17, precision 8, then height and width.
  bytes.set([0xff, 0xc0, 0x00, 0x11, 0x08], 2);
  bytes[7] = (height >> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (width >> 8) & 0xff;
  bytes[10] = width & 0xff;
  return bytes;
}

function gif(width = 7, height = 9): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
  bytes[6] = width & 0xff;
  bytes[7] = width >> 8;
  bytes[8] = height & 0xff;
  bytes[9] = height >> 8;
  return bytes;
}

function webpVp8x(width = 300, height = 200): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  bytes[24] = (width - 1) & 0xff;
  bytes[25] = (width - 1) >> 8;
  bytes[27] = (height - 1) & 0xff;
  bytes[28] = (height - 1) >> 8;
  return bytes;
}

function svg(): Uint8Array {
  return new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
}

describe("sniffImageType", () => {
  it("detects PNG dimensions", () => {
    expect(sniffImageType(png(12, 34))).toEqual({ mimeType: "image/png", extension: "png", width: 12, height: 34 });
  });

  it("detects JPEG dimensions", () => {
    expect(sniffImageType(jpeg())).toEqual({ mimeType: "image/jpeg", extension: "jpg", width: 640, height: 480 });
  });

  it("detects GIF dimensions", () => {
    expect(sniffImageType(gif())).toEqual({ mimeType: "image/gif", extension: "gif", width: 7, height: 9 });
  });

  it("detects WebP dimensions", () => {
    expect(sniffImageType(webpVp8x())).toEqual({ mimeType: "image/webp", extension: "webp", width: 300, height: 200 });
  });

  it("rejects SVG and unknown content", () => {
    expect(sniffImageType(svg())).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("plain text"))).toBeNull();
  });
});

describe("validateMediaUpload", () => {
  it("accepts a matching image", () => {
    const result = validateMediaUpload({
      declaredType: "image/png",
      fileName: "logo.png",
      bytes: png(),
      altText: "  Logo Flexbox  ",
    });

    expect(result.mimeType).toBe("image/png");
    expect(result.altText).toBe("Logo Flexbox");
    expect(result.originalName).toBe("logo.png");
  });

  it("rejects a mismatched declared type", () => {
    expect(() =>
      validateMediaUpload({ declaredType: "image/jpeg", fileName: "logo.png", bytes: png() }),
    ).toThrowError(MediaValidationError);
  });

  it("rejects a mismatched extension even when the declared type matches", () => {
    expect(() =>
      validateMediaUpload({ declaredType: "image/png", fileName: "logo.svg", bytes: png() }),
    ).toThrowError(/Ekstensi/);
  });

  it("accepts both jpg and jpeg extensions", () => {
    expect(() => validateMediaUpload({ declaredType: "image/jpeg", fileName: "a.jpeg", bytes: jpeg() })).not.toThrow();
    expect(() => validateMediaUpload({ declaredType: "image/jpeg", fileName: "a.jpg", bytes: jpeg() })).not.toThrow();
  });

  it("rejects SVG uploads", () => {
    expect(() =>
      validateMediaUpload({ declaredType: "image/svg+xml", fileName: "icon.svg", bytes: svg() }),
    ).toThrowError(/tidak didukung/);
  });

  it("rejects an empty file", () => {
    expect(() =>
      validateMediaUpload({ declaredType: "image/png", fileName: "empty.png", bytes: new Uint8Array() }),
    ).toThrowError(/kosong/);
  });

  it("rejects a file above the size limit", () => {
    const oversized = new Uint8Array(MAX_MEDIA_BYTES + 1);
    oversized.set(png().slice(0, 8), 0);

    expect(() =>
      validateMediaUpload({ declaredType: "image/png", fileName: "big.png", bytes: oversized }),
    ).toThrowError(/5 MB/);
  });

  it("rejects over-long alt text", () => {
    expect(() =>
      validateMediaUpload({ declaredType: "image/png", fileName: "a.png", bytes: png(), altText: "x".repeat(301) }),
    ).toThrowError(/300/);
  });
});

describe("sanitizeOriginalName", () => {
  it("strips paths and control characters", () => {
    expect(sanitizeOriginalName("C:\\Users\\me\\logo.png")).toBe("logo.png");
    expect(sanitizeOriginalName("bad\u0000name<>.png")).toBe("badname.png");
  });

  it("falls back when nothing usable remains", () => {
    expect(sanitizeOriginalName("<>")).toBe("upload");
  });
});