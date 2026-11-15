import { NextResponse, type NextRequest } from "next/server";

import { collectPageView } from "@/features/analytics/services/collect-events";
import { allowCollectorRequest } from "@/features/analytics/services/collector-rate-limit";
import { isAcceptedContentType, parseEventBody } from "@/features/analytics/schemas/event";
import { serializeAnalyticsCookie } from "@/features/analytics/services/session-identity";

/**
 * Public first-party collector (`/api/analytics/collect`).
 *
 * Design contract (see `.docs/ANALYTICS_SPECIFICATION.md`):
 *  - accepts exactly one event shape (`page_view`),
 *  - never redirects, never blocks the page, never throws to the client,
 *  - responds 204 to everything, so failure and "recorded" are indistinguishable
 *    to the visitor and analytics can never break navigation,
 *  - sets the visitor/session cookies only after a request is accepted.
 *
 * A 204 for a rejected event is intentional: counting the rejection would leak
 * nothing, an error body would invite probing, and the beacon fire-and-forgets.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAcceptedContentType(request.headers.get("content-type"))) {
    return new NextResponse(null, { status: 204 });
  }

  const source = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "global";

  if (!allowCollectorRequest(source)) {
    return new NextResponse(null, { status: 204 });
  }

  let body = "";

  try {
    body = await request.text();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = parseEventBody(body);

  if (!parsed.ok) {
    return new NextResponse(null, { status: 204 });
  }

  const result = await collectPageView({
    payload: parsed.event,
    requestUrl: request.url,
    userAgent: request.headers.get("user-agent"),
    referrerHeader: request.headers.get("referer"),
  });

  const headers = new Headers({ "cache-control": "no-store" });

  for (const cookie of result.cookiesToSet) {
    headers.append("Set-Cookie", serializeAnalyticsCookie(cookie));
  }

  return new NextResponse(null, { status: 204, headers });
}