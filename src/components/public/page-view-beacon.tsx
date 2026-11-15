"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget same-origin page-view beacon.
 *
 * The browser sends only a narrow event envelope. Visitor/session cookies are
 * HttpOnly and therefore not readable here; the server collector owns identity,
 * normalization, authorization exclusion, and validation. Failure is intentionally
 * silent so analytics never delays or breaks the public page.
 *
 * The envelope is built defensively because the collector's schema is strict: an
 * over-long referrer or a campaign value with a space would reject the whole
 * event, silently losing a legitimate page view. Values are therefore trimmed to
 * the documented shape here, and anything that does not match is omitted.
 */

/** Matches the server-side campaign rule in `schemas/event.ts`. */
const CAMPAIGN_VALUE = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,63}$/;
const MAX_REFERRER_LENGTH = 512;

function campaignValue(search: URLSearchParams, key: string): string | undefined {
  const raw = search.get(key)?.trim() ?? "";

  return CAMPAIGN_VALUE.test(raw) ? raw : undefined;
}

export default function PageViewBeacon() {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const campaign = {
      source: campaignValue(search, "utm_source"),
      medium: campaignValue(search, "utm_medium"),
      name: campaignValue(search, "utm_campaign"),
    };

    const payload = JSON.stringify({
      type: "page_view",
      // Query string is dropped: the collector only needs the page for the
      // deduplication window, and campaign fields carry the attribution.
      path: window.location.pathname,
      referrerUrl: document.referrer ? document.referrer.slice(0, MAX_REFERRER_LENGTH) : undefined,
      campaign:
        campaign.source || campaign.medium || campaign.name
          ? {
              ...(campaign.source ? { source: campaign.source } : {}),
              ...(campaign.medium ? { medium: campaign.medium } : {}),
              ...(campaign.name ? { name: campaign.name } : {}),
            }
          : undefined,
    });

    try {
      const body = new Blob([payload], { type: "application/json" });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/collect", body);
        return;
      }

      void fetch("/api/analytics/collect", {
        method: "POST",
        body: payload,
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Analytics is optional. The page must remain fully usable when the
      // browser blocks beacons or the collector is unavailable.
    }
  }, []);

  return null;
}