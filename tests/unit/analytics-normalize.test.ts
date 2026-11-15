import { describe, expect, it } from "vitest";

import { checkCollectionExclusion } from "@/features/analytics/services/bot-filter";
import {
  classifyReferrer,
  isLikelyBot,
  normalizeBrowserFamily,
  normalizeDeviceType,
  normalizeOsFamily,
  normalizePublicPath,
  sanitizeCampaignValue,
  truncateUserAgent,
} from "@/features/analytics/utils/normalize";

/**
 * Request normalization and exclusion.
 *
 * These are the privacy-critical unit boundaries: whatever these functions do not
 * return is what the database will never contain. The assertions therefore focus
 * on the *absence* of raw values as much as on the classification itself.
 */

const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1";
const EDGE_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1";

describe("bot filtering", () => {
  it("flags known automation and accepts real browser strings", () => {
    for (const ua of [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "Slackbot-LinkExpanding 1.0",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "HeadlessChrome/131.0.0.0",
      "Lighthouse/11.0.0",
    ]) {
      expect(isLikelyBot(ua), ua).toBe(true);
    }

    expect(isLikelyBot(CHROME_DESKTOP)).toBe(false);
    expect(isLikelyBot(SAFARI_IPHONE)).toBe(false);
  });

  it("treats a missing or empty User-Agent as automation", () => {
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("")).toBe(true);
    expect(isLikelyBot("   ")).toBe(true);
  });

  it("bounds the User-Agent before matching so a huge header cannot be amplified", () => {
    expect(truncateUserAgent("a".repeat(5_000)).length).toBe(1024);
  });
});

describe("device, browser, and OS classification", () => {
  it("classifies desktop, mobile, and tablet without storing the raw string", () => {
    expect(normalizeDeviceType(CHROME_DESKTOP)).toBe("DESKTOP");
    expect(normalizeDeviceType(SAFARI_IPHONE)).toBe("MOBILE");
    expect(normalizeDeviceType(IPAD)).toBe("TABLET");
    expect(normalizeDeviceType("SomeUnusualClient/1.0")).toBe("OTHER");
    expect(normalizeDeviceType(null)).toBe("UNKNOWN");
  });

  it("prefers Edge over Chrome because Chromium Edge also advertises Chrome", () => {
    expect(normalizeBrowserFamily(EDGE_DESKTOP)).toBe("EDGE");
    expect(normalizeBrowserFamily(CHROME_DESKTOP)).toBe("CHROME");
    expect(normalizeBrowserFamily(FIREFOX_LINUX)).toBe("FIREFOX");
    expect(normalizeBrowserFamily(SAFARI_IPHONE)).toBe("SAFARI");
    expect(normalizeBrowserFamily("Mozilla/5.0 (Unknown)")).toBe("OTHER");
    expect(normalizeBrowserFamily(null)).toBe("UNKNOWN");
  });

  it("resolves mobile platforms before their desktop token", () => {
    expect(normalizeOsFamily(SAFARI_IPHONE)).toBe("IOS");
    expect(normalizeOsFamily(IPAD)).toBe("IOS");
    expect(normalizeOsFamily("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36")).toBe("ANDROID");
    expect(normalizeOsFamily(CHROME_DESKTOP)).toBe("WINDOWS");
    expect(normalizeOsFamily(FIREFOX_LINUX)).toBe("LINUX");
  });

  it("returns only membership of a fixed enum, never an echo of the input", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) Custom/9.9";
    const values = [normalizeDeviceType(ua), normalizeBrowserFamily(ua), normalizeOsFamily(ua)];

    for (const value of values) {
      expect(value).not.toContain("Custom");
      expect(value).not.toContain("Mozilla");
    }
  });
});

describe("referrer classification", () => {
  const own = "flexbox.example";

  it("classifies a campaign before looking at the referrer host", () => {
    expect(
      classifyReferrer({ referrerUrl: "https://www.google.com/search?q=x", ownHostname: own, hasCampaign: true }),
    ).toBe("CAMPAIGN");
  });

  it("classifies direct, internal, search, social, and referral traffic", () => {
    expect(classifyReferrer({ referrerUrl: null, ownHostname: own, hasCampaign: false })).toBe("DIRECT");
    expect(classifyReferrer({ referrerUrl: "", ownHostname: own, hasCampaign: false })).toBe("DIRECT");
    expect(classifyReferrer({ referrerUrl: `https://${own}/blog`, ownHostname: own, hasCampaign: false })).toBe(
      "INTERNAL",
    );
    expect(classifyReferrer({ referrerUrl: "https://www.google.com/search?q=flexbox", ownHostname: own, hasCampaign: false })).toBe(
      "SEARCH",
    );
    expect(classifyReferrer({ referrerUrl: "https://t.co/abc123", ownHostname: own, hasCampaign: false })).toBe("SOCIAL");
    expect(classifyReferrer({ referrerUrl: "https://news.example/story", ownHostname: own, hasCampaign: false })).toBe(
      "REFERRAL",
    );
  });

  it("never returns anything derived from the referrer path or query string", () => {
    const category = classifyReferrer({
      referrerUrl: "https://news.example/secret/path?token=abc#frag",
      ownHostname: own,
      hasCampaign: false,
    });

    expect(category).toBe("REFERRAL");
    expect(category).not.toContain("secret");
    expect(category).not.toContain("token");
  });

  it("marks an unparsable or non-HTTP referrer as unknown instead of guessing", () => {
    expect(classifyReferrer({ referrerUrl: "not a url", ownHostname: own, hasCampaign: false })).toBe("UNKNOWN");
    expect(classifyReferrer({ referrerUrl: "android-app://com.example", ownHostname: own, hasCampaign: false })).toBe(
      "UNKNOWN",
    );
  });
});

describe("campaign sanitization", () => {
  it("keeps only short, machine-shaped values", () => {
    expect(sanitizeCampaignValue("newsletter-2026")).toBe("newsletter-2026");
    expect(sanitizeCampaignValue("  spring_sale  ")).toBe("spring_sale");
    expect(sanitizeCampaignValue("a".repeat(64))).toBe("a".repeat(64));
  });

  it("drops values that could carry personal data or free text", () => {
    expect(sanitizeCampaignValue("person@example.com")).toBeNull();
    expect(sanitizeCampaignValue("Free text with spaces")).toBeNull();
    expect(sanitizeCampaignValue("a".repeat(65))).toBeNull();
    expect(sanitizeCampaignValue("-leading-dash")).toBeNull();
    expect(sanitizeCampaignValue("<script>")).toBeNull();
    expect(sanitizeCampaignValue(42)).toBeNull();
    expect(sanitizeCampaignValue(null)).toBeNull();
  });
});

describe("public path normalization", () => {
  it("canonicalizes a public page path", () => {
    expect(normalizePublicPath("/")).toBe("/");
    expect(normalizePublicPath("/About")).toBe("/about");
    expect(normalizePublicPath("https://flexbox.example/work?utm_source=x#top")).toBe("/work");
  });

  it("refuses anything that is not a public page", () => {
    for (const value of [
      "/admin",
      "/admin/links",
      "/api/analytics/collect",
      "/go/123e4567-e89b-42d3-a456-426614174000",
      "/_next/static/chunk.js",
      "/media/uploads/logo.png",
      "/styles.css",
      "//evil.example",
      `/${"a".repeat(300)}`,
    ]) {
      expect(normalizePublicPath(value), value).toBeNull();
    }
  });
});

describe("collection exclusion", () => {
  it("skips automation, probes, and non-page targets", () => {
    expect(checkCollectionExclusion({ userAgent: "Googlebot/2.1", path: "/" })).toEqual({ skip: true, reason: "bot" });
    expect(checkCollectionExclusion({ userAgent: CHROME_DESKTOP, path: "/healthz" })).toEqual({
      skip: true,
      reason: "probe",
    });
    expect(checkCollectionExclusion({ userAgent: CHROME_DESKTOP, path: null })).toEqual({
      skip: true,
      reason: "non_page",
    });
    expect(checkCollectionExclusion({ userAgent: CHROME_DESKTOP, path: "/" })).toEqual({ skip: false });
  });
});
