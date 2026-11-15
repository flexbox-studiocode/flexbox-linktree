import "server-only";

import { getCurrentAdmin } from "@/lib/auth/session";
import { recordAnalyticsEvent } from "@/features/analytics/repositories/events";
import { checkCollectionExclusion } from "@/features/analytics/services/bot-filter";
import { classifyRequest, requestHostname } from "@/features/analytics/services/parse-request-context";
import { resolveAnalyticsIdentity, type AnalyticsCookieInstruction } from "@/features/analytics/services/session-identity";
import type { PageViewEventPayload } from "@/features/analytics/schemas/event";
import type { CampaignFields, LinkSnapshot, RecordEventResult } from "@/features/analytics/types";
import { analyticsHashingEnabled, dedupeWindowBucket, keyedDigest } from "@/features/analytics/utils/hash";
import { normalizePublicPath, sanitizeCampaignValue } from "@/features/analytics/utils/normalize";

/**
 * Narrow analytics collection service shared by the public beacon and `/go`.
 * Every caller gets a stable non-throwing outcome so analytics cannot become a
 * dependency of public rendering or navigation.
 */

export type CollectResult = {
  outcome: RecordEventResult | "excluded" | "admin" | "failed";
  cookiesToSet: AnalyticsCookieInstruction[];
};

function campaignOf(payload: PageViewEventPayload): CampaignFields {
  return {
    campaignSource: sanitizeCampaignValue(payload.campaign?.source),
    campaignMedium: sanitizeCampaignValue(payload.campaign?.medium),
    campaignName: sanitizeCampaignValue(payload.campaign?.name),
  };
}

function logCollectionFailure(eventType: string, error: unknown): void {
  // Identifier values, raw headers, URLs, and payloads are intentionally absent.
  console.error(`[analytics] ${eventType} collection failed (${error instanceof Error ? error.name : "UnknownError"})`);
}

function dedupeKey(input: { eventType: "PAGE_VIEW" | "LINK_CLICK"; identity: string | null; target: string; now: Date }): string | null {
  if (!input.identity) {
    return null;
  }

  return keyedDigest(`${input.eventType}:${input.identity}:${input.target}:${dedupeWindowBucket(input.now)}`);
}

/** Collects a validated public page view. Never throws to a route caller. */
export async function collectPageView(params: {
  payload: PageViewEventPayload;
  requestUrl: string;
  userAgent: string | null;
  referrerHeader: string | null;
  now?: Date;
}): Promise<CollectResult> {
  if (!analyticsHashingEnabled()) {
    return { outcome: "disabled", cookiesToSet: [] };
  }

  const path = normalizePublicPath(params.payload.path ?? "/");
  const exclusion = checkCollectionExclusion({ userAgent: params.userAgent, path });

  if (exclusion.skip) {
    return { outcome: "excluded", cookiesToSet: [] };
  }

  // This is an actual server-side authorization lookup, not a browser boolean.
  if (await getCurrentAdmin()) {
    return { outcome: "admin", cookiesToSet: [] };
  }

  const identity = await resolveAnalyticsIdentity();
  const campaign = campaignOf(params.payload);
  const classification = classifyRequest({
    userAgent: params.userAgent,
    referrerUrl: params.payload.referrerUrl ?? params.referrerHeader,
    ownHostname: requestHostname(params.requestUrl),
    hasCampaign: Boolean(campaign.campaignSource || campaign.campaignMedium || campaign.campaignName),
  });
  const now = params.now ?? new Date();

  try {
    const outcome = await recordAnalyticsEvent({
      eventType: "PAGE_VIEW",
      occurredAt: now,
      visitorKeyHash: identity.visitorKeyHash,
      sessionKeyHash: identity.sessionKeyHash,
      dedupeKey: dedupeKey({ eventType: "PAGE_VIEW", identity: identity.sessionKeyHash, target: path!, now }),
      deviceType: classification.deviceType,
      browserFamily: classification.browserFamily,
      osFamily: classification.osFamily,
      referrerCategory: classification.referrerCategory,
      campaign,
    });

    return { outcome, cookiesToSet: identity.cookiesToSet };
  } catch (error) {
    logCollectionFailure("PAGE_VIEW", error);
    return { outcome: "failed", cookiesToSet: identity.cookiesToSet };
  }
}

/**
 * Collects a server-resolved click. `link` is loaded from PostgreSQL by the
 * redirect route, never received from the browser. No throw escapes to delay a
 * valid redirect.
 */
export async function collectLinkClick(params: {
  link: LinkSnapshot;
  requestUrl: string;
  userAgent: string | null;
  referrerHeader: string | null;
  now?: Date;
}): Promise<CollectResult> {
  try {
    if (!analyticsHashingEnabled()) {
      return { outcome: "disabled", cookiesToSet: [] };
    }

    if (await getCurrentAdmin()) {
      return { outcome: "admin", cookiesToSet: [] };
    }

    if (checkCollectionExclusion({ userAgent: params.userAgent, path: "/" }).skip) {
      return { outcome: "excluded", cookiesToSet: [] };
    }

    const identity = await resolveAnalyticsIdentity();
    const now = params.now ?? new Date();
    const classification = classifyRequest({
      userAgent: params.userAgent,
      referrerUrl: params.referrerHeader,
      ownHostname: requestHostname(params.requestUrl),
      hasCampaign: false,
    });

    const outcome = await recordAnalyticsEvent({
      eventType: "LINK_CLICK",
      occurredAt: now,
      visitorKeyHash: identity.visitorKeyHash,
      sessionKeyHash: identity.sessionKeyHash,
      dedupeKey: dedupeKey({ eventType: "LINK_CLICK", identity: identity.sessionKeyHash, target: params.link.linkId, now }),
      deviceType: classification.deviceType,
      browserFamily: classification.browserFamily,
      osFamily: classification.osFamily,
      referrerCategory: classification.referrerCategory,
      campaign: { campaignSource: null, campaignMedium: null, campaignName: null },
      link: params.link,
    });

    return { outcome, cookiesToSet: identity.cookiesToSet };
  } catch (error) {
    logCollectionFailure("LINK_CLICK", error);
    return { outcome: "failed", cookiesToSet: [] };
  }
}