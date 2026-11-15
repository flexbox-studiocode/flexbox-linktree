import {
  classifyReferrer,
  isLikelyBot,
  normalizeBrowserFamily,
  normalizeDeviceType,
  normalizeOsFamily,
} from "@/features/analytics/utils/normalize";
import type { RequestClassification } from "@/features/analytics/types";

/**
 * Turns raw request headers into the closed set of stored categories.
 *
 * The raw values are read here and discarded. Nothing in the returned object is
 * a personal identifier, and nothing outside this object is persisted from the
 * request.
 */

/** Hostname of the request the collector answered, used for same-origin detection. */
export function requestHostname(requestUrl: string): string | null {
  try {
    return new URL(requestUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function classifyRequest(input: {
  userAgent: string | null;
  referrerUrl: string | null;
  ownHostname: string | null;
  hasCampaign: boolean;
}): RequestClassification {
  return {
    deviceType: normalizeDeviceType(input.userAgent),
    browserFamily: normalizeBrowserFamily(input.userAgent),
    osFamily: normalizeOsFamily(input.userAgent),
    referrerCategory: classifyReferrer({
      referrerUrl: input.referrerUrl,
      ownHostname: input.ownHostname,
      hasCampaign: input.hasCampaign,
    }),
    isBot: isLikelyBot(input.userAgent),
  };
}