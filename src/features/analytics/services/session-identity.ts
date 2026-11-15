import "server-only";

import { cookies } from "next/headers";

import { isSecureCookieContext } from "@/lib/auth/cookies";
import { keyedDigest, randomIdentifier } from "@/features/analytics/utils/hash";

/**
 * First-party analytics identity.
 *
 * Two independent random identifiers live in `HttpOnly` cookies, so page scripts
 * cannot read them and a third-party script cannot join them to another site.
 * Only keyed digests of the values are handed to the storage layer.
 *
 * The session identifier has no server-side expiry row: the cookie's own
 * `Max-Age` is re-issued on every accepted event, which implements the documented
 * 30-minute inactivity window without a session table. A cookie jar that expires
 * the session automatically creates the next session identifier.
 */

export const VISITOR_COOKIE = "fb_analytics_visitor";
export const SESSION_COOKIE = "fb_analytics_session";

export const VISITOR_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
export const SESSION_MAX_AGE_SECONDS = 30 * 60;

export type AnalyticsCookieInstruction = {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
};

export type AnalyticsIdentity = {
  visitorKeyHash: string | null;
  sessionKeyHash: string | null;
  cookiesToSet: AnalyticsCookieInstruction[];
};

function buildCookie(name: string, value: string, maxAge: number): AnalyticsCookieInstruction {
  return {
    name,
    value,
    maxAge,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieContext(),
    path: "/",
  };
}

/** Serializes one instruction into a `Set-Cookie` header value. */
export function serializeAnalyticsCookie(cookie: AnalyticsCookieInstruction): string {
  const parts = [
    `${cookie.name}=${cookie.value}`,
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
    "HttpOnly",
    `SameSite=${cookie.sameSite === "lax" ? "Lax" : cookie.sameSite}`,
  ];

  if (cookie.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

const RANDOM_VALUE = /^[A-Za-z0-9_-]{16,64}$/;

function readCookieValue(value: string | undefined): string | null {
  if (!value || !RANDOM_VALUE.test(value)) {
    return null;
  }

  return value;
}

/**
 * Resolves the current identity and the cookies the collector must re-issue.
 *
 * A new visitor identifier is only minted when none exists. A session identifier
 * is minted when none exists — the browser removes it after the inactivity window,
 * so its absence *is* the inactivity signal.
 */
export async function resolveAnalyticsIdentity(): Promise<AnalyticsIdentity> {
  const jar = await cookies();
  const cookiesToSet: AnalyticsCookieInstruction[] = [];

  const existingVisitor = readCookieValue(jar.get(VISITOR_COOKIE)?.value);
  const visitorId = existingVisitor ?? randomIdentifier();

  if (!existingVisitor) {
    cookiesToSet.push(buildCookie(VISITOR_COOKIE, visitorId, VISITOR_MAX_AGE_SECONDS));
  }

  const existingSession = readCookieValue(jar.get(SESSION_COOKIE)?.value);
  const sessionId = existingSession ?? randomIdentifier();

  // Re-issue on every accepted event to slide the inactivity window.
  cookiesToSet.push(buildCookie(SESSION_COOKIE, sessionId, SESSION_MAX_AGE_SECONDS));

  return {
    visitorKeyHash: keyedDigest(`visitor:${visitorId}`),
    sessionKeyHash: keyedDigest(`session:${sessionId}`),
    cookiesToSet,
  };
}