import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { collectLinkClick } from "@/features/analytics/services/collect-events";
import { findTrackableLink } from "@/features/analytics/repositories/links";

/**
 * Safe server-resolved external redirect (`/go/[linkId]`).
 *
 * The browser supplies only a UUID. The destination is selected from PostgreSQL
 * after rechecking publication, link/category activation, and allowed URL scheme.
 * Analytics collection is best-effort and bounded; no request parameter can turn
 * this route into an open redirect.
 */

const linkIdSchema = z.uuid();
const ANALYTICS_TIMEOUT_MS = 1_500;

function notFound(): NextResponse {
  return new NextResponse("Tautan tidak tersedia.", {
    status: 404,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": "text/plain; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function safeLog(error: unknown): void {
  console.error(`[analytics] redirect lookup failed (${error instanceof Error ? error.name : "UnknownError"})`);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ linkId: string }> },
): Promise<NextResponse> {
  const { linkId } = await context.params;
  const parsed = linkIdSchema.safeParse(linkId);

  if (!parsed.success) {
    return notFound();
  }

  let link: Awaited<ReturnType<typeof findTrackableLink>>;

  try {
    link = await findTrackableLink(parsed.data);
  } catch (error) {
    safeLog(error);
    return notFound();
  }

  if (!link) {
    return notFound();
  }

  const response = NextResponse.redirect(link.destinationUrl, 307);
  response.headers.set("cache-control", "no-store, max-age=0");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("x-content-type-options", "nosniff");

  // Analytics failures do not block or invalidate the safe redirect. Cookies are
  // set only if collection resolved an identity; they remain HttpOnly.
  const collection = collectLinkClick({
    link: {
      linkId: link.linkId,
      linkSlugSnapshot: link.slug,
      linkTitleSnapshot: link.title,
      linkCategorySnapshot: link.categoryName,
    },
    requestUrl: request.url,
    userAgent: request.headers.get("user-agent"),
    referrerHeader: request.headers.get("referer"),
  }).catch((error: unknown) => {
    safeLog(error);
    return { cookiesToSet: [] };
  });

  const timeout = new Promise<{ cookiesToSet: [] }>((resolve) => {
    setTimeout(() => resolve({ cookiesToSet: [] }), ANALYTICS_TIMEOUT_MS);
  });

  const result = await Promise.race([collection, timeout]);

  for (const cookie of result.cookiesToSet) {
    response.headers.append("Set-Cookie", `${cookie.name}=${cookie.value}; Path=${cookie.path}; Max-Age=${cookie.maxAge}; HttpOnly; SameSite=Lax${cookie.secure ? "; Secure" : ""}`);
  }

  return response;
}