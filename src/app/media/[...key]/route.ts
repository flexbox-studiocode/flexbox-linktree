import { readMediaObject } from "@/features/media/service";

/**
 * Serves stored media when the provider cannot expose a public URL.
 *
 * The key is only used as a lookup in `media_assets`: an unknown key returns 404,
 * so this route cannot be used to read arbitrary objects from the storage
 * backend. Response bytes and the MIME type come from the validated record.
 */
export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const storageKey = key.map((segment) => decodeURIComponent(segment)).join("/");

  const object = await readMediaObject(storageKey).catch(() => null);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(object.body), {
    headers: {
      "Content-Type": object.asset.mimeType,
      "Content-Length": String(object.asset.sizeBytes),
      "Cache-Control": "public, max-age=3600, must-revalidate",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}