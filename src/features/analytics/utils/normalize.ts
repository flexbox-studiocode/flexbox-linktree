import type {
  BrowserFamily,
  DeviceType,
  OsFamily,
  ReferrerCategory,
} from "@/features/analytics/types";

/**
 * Deterministic request normalization.
 *
 * The raw `User-Agent` and the raw referrer URL never leave this module. Only the
 * categories it returns are stored. The rules are intentionally small, auditable,
 * and conservative: an unrecognized value becomes `OTHER` (a real client we do
 * not model) or `UNKNOWN` (no usable signal), never a guess that invents
 * precision.
 */

const UA_LIMIT = 1024;

export function truncateUserAgent(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.trim().slice(0, UA_LIMIT);
}

const BOT_SIGNATURES = [
  "bot",
  "crawler",
  "crawl",
  "spider",
  "slurp",
  "bingpreview",
  "facebookexternalhit",
  "embedly",
  "quora link preview",
  "pinterest/",
  "vkshare",
  "w3c_validator",
  "headlesschrome",
  "headless",
  "phantomjs",
  "lighthouse",
  "pagespeed",
  "gtmetrix",
  "pingdom",
  "uptimerobot",
  "statuscake",
  "site24x7",
  "datadog",
  "newrelic",
  "curl/",
  "wget/",
  "httpie",
  "python-requests",
  "python-urllib",
  "aiohttp",
  "go-http-client",
  "axios/",
  "node-fetch",
  "okhttp",
  "java/",
  "libwww-perl",
  "postmanruntime",
  "insomnia",
];

/**
 * Conservative crawler/monitor heuristic.
 *
 * Documented limitation: a bot presenting a real browser string is counted, and
 * an unusual legitimate client may be filtered. Filtering never blocks a page or
 * a redirect, so a false positive costs one metric, not a visitor.
 */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  const value = truncateUserAgent(userAgent).toLowerCase();

  if (value.length === 0) {
    // An empty User-Agent is not a browser. Treat it as automation.
    return true;
  }

  return BOT_SIGNATURES.some((signature) => value.includes(signature));
}

export function normalizeDeviceType(userAgent: string | null | undefined): DeviceType {
  const value = truncateUserAgent(userAgent).toLowerCase();

  if (value.length === 0) {
    return "UNKNOWN";
  }

  if (/ipad|tablet|kindle|silk\/|playbook|nexus 7|nexus 9/.test(value)) {
    return "TABLET";
  }

  if (/android/.test(value) && !/mobile/.test(value)) {
    return "TABLET";
  }

  if (/mobi|iphone|ipod|android|windows phone|blackberry|bb10|opera mini|iemobile/.test(value)) {
    return "MOBILE";
  }

  if (/windows nt|macintosh|mac os x|x11|cros|linux/.test(value)) {
    return "DESKTOP";
  }

  return "OTHER";
}

export function normalizeBrowserFamily(userAgent: string | null | undefined): BrowserFamily {
  const value = truncateUserAgent(userAgent).toLowerCase();

  if (value.length === 0) {
    return "UNKNOWN";
  }

  // Edge before Chrome: Chromium Edge also advertises `Chrome/`.
  if (/edg(e|a|ios)?\//.test(value)) {
    return "EDGE";
  }

  if (/firefox\/|fxios\//.test(value)) {
    return "FIREFOX";
  }

  if (/chrome\/|crios\/|chromium\//.test(value)) {
    return "CHROME";
  }

  if (/safari\//.test(value)) {
    return "SAFARI";
  }

  return /mozilla\//.test(value) ? "OTHER" : "UNKNOWN";
}

export function normalizeOsFamily(userAgent: string | null | undefined): OsFamily {
  const value = truncateUserAgent(userAgent).toLowerCase();

  if (value.length === 0) {
    return "UNKNOWN";
  }

  // Android and iOS are checked before Linux/macOS because their UA strings
  // contain the desktop token as well.
  if (/android/.test(value)) {
    return "ANDROID";
  }

  if (/iphone|ipad|ipod/.test(value)) {
    return "IOS";
  }

  if (/windows/.test(value)) {
    return "WINDOWS";
  }

  if (/macintosh|mac os x/.test(value)) {
    return "MACOS";
  }

  if (/cros/.test(value)) {
    return "LINUX";
  }

  if (/linux|x11/.test(value)) {
    return "LINUX";
  }

  return /mozilla\//.test(value) ? "OTHER" : "UNKNOWN";
}

const SEARCH_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "yandex.",
  "baidu.",
  "ecosia.",
  "brave.",
  "startpage.",
  "naver.",
  "search.marginalia.",
  "qwant.",
];

const SOCIAL_HOSTS = [
  "facebook.",
  "fb.",
  "instagram.",
  "t.co",
  "twitter.",
  "x.com",
  "linkedin.",
  "lnkd.in",
  "tiktok.",
  "pinterest.",
  "youtube.",
  "youtu.be",
  "reddit.",
  "whatsapp.",
  "wa.me",
  "telegram.",
  "t.me",
  "threads.",
  "snapchat.",
  "mastodon.",
  "bsky.app",
  "discord.",
];

function safeHostname(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, candidates: string[]): boolean {
  return candidates.some((candidate) =>
    candidate.endsWith(".") ? host.includes(candidate) : host === candidate || host.startsWith(candidate) || host.endsWith(`.${candidate}`),
  );
}

/**
 * Classifies a referrer without storing it.
 *
 * Only the host family is derived. Paths, query strings, fragments, and any
 * identifier a referrer URL might carry are discarded here and never persisted.
 */
export function classifyReferrer(input: {
  referrerUrl: string | null | undefined;
  ownHostname: string | null;
  hasCampaign: boolean;
}): ReferrerCategory {
  if (input.hasCampaign) {
    return "CAMPAIGN";
  }

  const raw = input.referrerUrl?.trim();

  if (!raw) {
    return "DIRECT";
  }

  const host = safeHostname(raw);

  if (!host) {
    // Present but unparsable, or a non-HTTP scheme.
    return "UNKNOWN";
  }

  if (input.ownHostname && host === input.ownHostname.toLowerCase()) {
    return "INTERNAL";
  }

  if (hostMatches(host, SEARCH_HOSTS)) {
    return "SEARCH";
  }

  if (hostMatches(host, SOCIAL_HOSTS)) {
    return "SOCIAL";
  }

  return "REFERRAL";
}

const CAMPAIGN_VALUE = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,63}$/;

/**
 * Keeps a campaign field only when it is short and unambiguously machine-shaped.
 * An email address, a token, or free text is dropped rather than truncated, so a
 * malformed campaign parameter cannot smuggle personal data into storage.
 */
export function sanitizeCampaignValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return CAMPAIGN_VALUE.test(trimmed) ? trimmed : null;
}

const EXCLUDED_PREFIXES = ["/admin", "/api", "/go", "/_next", "/media"];
const STATIC_EXTENSION = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|txt|xml|json)$/i;

/**
 * Validates and canonicalizes a public page path for deduplication.
 *
 * The canonical path is used only inside the dedupe hash; it is never stored.
 * Returns `null` for anything that is not a public page view (CMS, API,
 * tracking redirect, static asset, protocol-relative, or over-long value).
 */
export function normalizePublicPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return "/";
  }

  // A protocol-relative reference has no meaningful page path. `new URL()` would
  // resolve it to "/" and silently conflate it with the home page, so reject it.
  if (value.trim().startsWith("//")) {
    return null;
  }

  let path: string;

  try {
    const url = new URL(value, "http://localhost");
    path = url.pathname;
  } catch {
    return null;
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.length === 0) {
    return null;
  }

  if (path.length > 256) {
    return null;
  }

  const lower = path.toLowerCase();

  if (EXCLUDED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))) {
    return null;
  }

  if (STATIC_EXTENSION.test(lower)) {
    return null;
  }

  return lower;
}