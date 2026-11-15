/**
 * Analytics domain types shared by collection, aggregation, and reporting.
 *
 * These are presentation-safe: they contain no raw visitor identifier, no raw
 * request header, and no secret. Counting is done with numbers because a
 * microsite cannot plausibly exceed 2^31 events inside the retained window.
 */

export type AnalyticsEventKind = "PAGE_VIEW" | "LINK_CLICK";

export type DeviceType = "DESKTOP" | "MOBILE" | "TABLET" | "OTHER" | "UNKNOWN";

export type BrowserFamily = "CHROME" | "SAFARI" | "FIREFOX" | "EDGE" | "OTHER" | "UNKNOWN";

export type OsFamily = "WINDOWS" | "MACOS" | "LINUX" | "ANDROID" | "IOS" | "OTHER" | "UNKNOWN";

export type ReferrerCategory =
  | "DIRECT"
  | "SEARCH"
  | "SOCIAL"
  | "REFERRAL"
  | "CAMPAIGN"
  | "INTERNAL"
  | "UNKNOWN";

export type AnalyticsDimension = "TOTAL" | "DEVICE" | "BROWSER" | "OS" | "REFERRER";

/** Coarse request facts derived in memory from headers, never persisted raw. */
export type RequestClassification = {
  deviceType: DeviceType;
  browserFamily: BrowserFamily;
  osFamily: OsFamily;
  referrerCategory: ReferrerCategory;
  isBot: boolean;
};

export type CampaignFields = {
  campaignSource: string | null;
  campaignMedium: string | null;
  campaignName: string | null;
};

/** Immutable link identity copied from the database at click time. */
export type LinkSnapshot = {
  linkId: string;
  linkSlugSnapshot: string;
  linkTitleSnapshot: string;
  linkCategorySnapshot: string | null;
};

export type RecordEventInput = {
  eventType: AnalyticsEventKind;
  occurredAt: Date;
  visitorKeyHash: string | null;
  sessionKeyHash: string | null;
  dedupeKey: string | null;
  deviceType: DeviceType;
  browserFamily: BrowserFamily;
  osFamily: OsFamily;
  referrerCategory: ReferrerCategory;
  campaign: CampaignFields;
  link?: LinkSnapshot | null;
};

export type RecordEventResult = "recorded" | "duplicate" | "disabled" | "invalid";

export type AnalyticsAvailability = {
  /** Hash secret configured. Without it the collector records nothing. */
  enabled: boolean;
  /** Raw events exist inside the reported window. */
  hasEvents: boolean;
  /** Newest accepted event, for the "collection is active" indicator. */
  lastEventAt: Date | null;
};

export type AnalyticsRangePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export type AnalyticsGranularity = "hour" | "day" | "week" | "month";

export type AnalyticsRange = {
  preset: AnalyticsRangePreset;
  /** Inclusive Jakarta calendar day, `YYYY-MM-DD`. */
  fromDay: string;
  /** Inclusive Jakarta calendar day, `YYYY-MM-DD`. */
  toDay: string;
  /** UTC instant of Jakarta 00:00 on `fromDay`. */
  start: Date;
  /** UTC instant of Jakarta 00:00 on the day after `toDay` (exclusive end). */
  endExclusive: Date;
  granularity: AnalyticsGranularity;
  timeZone: string;
};

export type MetricComparison = {
  current: number;
  previous: number;
  /** One-decimal percentage, `null` when both periods are zero. */
  changePercent: number | null;
  /** True when the previous period had no activity but the current one does. */
  isNew: boolean;
};