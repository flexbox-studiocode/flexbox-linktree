import { z } from "zod";

/**
 * Media upload validation.
 *
 * The declared browser MIME type and the file extension are untrusted. The
 * actual type is derived from magic bytes, and the upload is rejected when the
 * extension, the declared type, and the detected type disagree. SVG is rejected
 * because it can carry script and this release has no sanitiser.
 */

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export const altTextSchema = z.string().trim().max(300).nullable().optional();

export type MediaValidationErrorCode =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "type_mismatch"
  | "invalid_alt_text";

export class MediaValidationError extends Error {
  readonly code: MediaValidationErrorCode;

  constructor(code: MediaValidationErrorCode, message: string) {
    super(message);
    this.name = "MediaValidationError";
    this.code = code;
  }
}

export type SniffedType = {
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.slice(offset, offset + length))
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function pngSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function gifSize(bytes: Uint8Array) {
  return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
}

function jpegSize(bytes: Uint8Array): { width: number | null; height: number | null } {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];

    // SOF0..SOF15 excluding DHT (C4), JPG (C8), DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }

    if (length <= 0) break;
    offset += 2 + length;
  }

  return { width: null, height: null };
}

function webpSize(bytes: Uint8Array): { width: number | null; height: number | null } {
  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8X" && bytes.length > 30) {
    return {
      width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
      height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
    };
  }

  if (chunk === "VP8 " && bytes.length > 30) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }

  if (chunk === "VP8L" && bytes.length > 25) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  return { width: null, height: null };
}

function avifSize(bytes: Uint8Array): { width: number | null; height: number | null } {
  // `ispe` box carries width and height as big-endian uint32 after a 4-byte version/flags field.
  const marker = ascii(bytes, 4, 4) === "ftyp" ? "ispe" : "";

  if (!marker) {
    return { width: null, height: null };
  }

  for (let index = 0; index + 16 < bytes.length; index += 1) {
    if (ascii(bytes, index, 4) !== "ispe") continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(index + 8, false), height: view.getUint32(index + 12, false) };
  }

  return { width: null, height: null };
}

/** Detects the real type from the byte stream. Returns `null` for anything unsupported. */
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const { width, height } = pngSize(bytes);
    return { mimeType: "image/png", extension: "png", width, height };
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const { width, height } = jpegSize(bytes);
    return { mimeType: "image/jpeg", extension: "jpg", width, height };
  }

  if (ascii(bytes, 0, 3) === "GIF") {
    const { width, height } = gifSize(bytes);
    return { mimeType: "image/gif", extension: "gif", width, height };
  }

  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    const { width, height } = webpSize(bytes);
    return { mimeType: "image/webp", extension: "webp", width, height };
  }

  if (ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4))) {
    const { width, height } = avifSize(bytes);
    return { mimeType: "image/avif", extension: "avif", width, height };
  }

  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return { mimeType: "image/x-icon", extension: "ico", width: null, height: null };
  }

  return null;
}

const EXTENSION_BY_MIME: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "image/x-icon": ["ico"],
};

export type ValidatedMedia = SniffedType & {
  originalName: string;
  sizeBytes: number;
  altText: string | null;
};

/** Validates an untrusted upload. Throws `MediaValidationError` on any violation. */
export function validateMediaUpload(input: {
  declaredType: string;
  fileName: string;
  bytes: Uint8Array;
  altText?: string | null;
}): ValidatedMedia {
  if (input.bytes.byteLength === 0) {
    throw new MediaValidationError("empty", "Berkas kosong.");
  }

  if (input.bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new MediaValidationError("too_large", "Ukuran berkas melebihi 5 MB.");
  }

  const sniffed = sniffImageType(input.bytes);

  if (!sniffed) {
    throw new MediaValidationError(
      "unsupported_type",
      "Format berkas tidak didukung. Gunakan PNG, JPEG, GIF, WebP, AVIF, atau ICO.",
    );
  }

  const declared = input.declaredType.toLowerCase().split(";")[0]?.trim() ?? "";
  const allowedExtensions = EXTENSION_BY_MIME[sniffed.mimeType] ?? [];

  if (declared && declared !== sniffed.mimeType) {
    throw new MediaValidationError("type_mismatch", "Tipe berkas tidak sesuai dengan isinya.");
  }

  const extension = input.fileName.includes(".") ? input.fileName.split(".").pop()?.toLowerCase() ?? "" : "";

  if (!allowedExtensions.includes(extension)) {
    throw new MediaValidationError(
      "type_mismatch",
      `Ekstensi berkas harus ${allowedExtensions.join(" atau ")} untuk tipe ${sniffed.mimeType}.`,
    );
  }

  const altParsed = altTextSchema.safeParse(input.altText ?? null);

  if (!altParsed.success) {
    throw new MediaValidationError("invalid_alt_text", "Teks alternatif maksimal 300 karakter.");
  }

  return {
    ...sniffed,
    originalName: sanitizeOriginalName(input.fileName),
    sizeBytes: input.bytes.byteLength,
    altText: altParsed.data ? altParsed.data : null,
  };
}

/** Keeps a display-only original name; the stored key never reuses it. */
export function sanitizeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
  return (cleaned.length > 0 ? cleaned : "upload").slice(0, 200);
}