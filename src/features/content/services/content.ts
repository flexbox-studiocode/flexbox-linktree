import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { fallbackSiteContent } from "@/features/content/fallbacks";
import {
  findPublicCategories,
  findSiteSettings,
} from "@/features/content/repositories/content";
import {
  toPublicCategory,
  type PublicCategoryRecord,
} from "@/features/content/mappers/public-content";
import { parseSiteSetting } from "@/features/content/schemas/site-setting";
import { publicContentCacheTag } from "@/features/content/services/cache-tag";
import type {
  SiteSettingKey,
  SiteSettingValue,
} from "@/features/content/schemas/site-setting";
import type {
  PublicCategory,
  PublicPageContent,
  PublicSiteContent,
} from "@/features/content/types/public-content";

/**
 * Cache policy for public content.
 *
 * `cacheLife("minutes")` bounds staleness: the `revalidate` window is 1 minute
 * and the entry expires after 1 hour, so new content cannot stay stale
 * indefinitely. `cacheTag` is set now so Phase 5 can invalidate on demand after
 * a CMS mutation (`revalidateTag("public-content", "max")`); no unauthenticated
 * revalidation endpoint is exposed in this phase.
 */
const CACHE_PROFILE = "minutes" as const;
const CACHE_TAG = publicContentCacheTag;

type CachedResult<T> = { ok: true; data: T } | { ok: false };

async function cachedPublicCategories(): Promise<CachedResult<PublicCategoryRecord[]>> {
  "use cache";
  cacheLife(CACHE_PROFILE);
  cacheTag(CACHE_TAG);

  try {
    return { ok: true, data: await findPublicCategories() };
  } catch (error) {
    logContentFailure("public categories query failed", error);

    return { ok: false };
  }
}

async function cachedSiteSettings(): Promise<CachedResult<Record<string, unknown>>> {
  "use cache";
  cacheLife(CACHE_PROFILE);
  cacheTag(CACHE_TAG);

  try {
    return { ok: true, data: await findSiteSettings() };
  } catch (error) {
    logContentFailure("site settings query failed", error);

    return { ok: false };
  }
}

/**
 * Logs a content failure without leaking credentials or a stack trace to the
 * public response. The message is server-side only.
 */
function logContentFailure(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.name : "UnknownError";
  console.error(`[content] ${message} (${detail})`);
}

/**
 * Reads and validates one setting. Returns `null` when the key is missing or
 * stored value is invalid, so the caller keeps the documented fallback for that
 * key instead of failing the whole page.
 */
function readSetting<K extends SiteSettingKey>(
  key: K,
  values: Record<string, unknown>,
): SiteSettingValue<K> | null {
  if (values[key] === undefined) {
    return null;
  }

  try {
    return parseSiteSetting(key, values[key]);
  } catch (error) {
    logContentFailure(`site setting "${key}" failed validation`, error);

    return null;
  }
}

/** Maps validated settings rows onto the flat public site-content shape. */
function buildSiteContent(values: Record<string, unknown> | null): PublicSiteContent {
  const site: PublicSiteContent = { ...fallbackSiteContent };

  if (values === null) {
    return site;
  }

  const general = readSetting("general", values);
  if (general) {
    site.name = general.name;
    site.wordmark = general.wordmark;
    site.wordmarkSuffix = general.wordmarkSuffix;
    site.supportingLabel = general.supportingLabel;
  }

  const navigation = readSetting("navigation", values);
  if (navigation) {
    site.headerNavLabel = navigation.headerNavLabel;
    site.contactNavLabel = navigation.contactNavLabel;
    site.headerCtaLabel = navigation.headerCtaLabel;
  }

  const hero = readSetting("hero", values);
  if (hero) {
    site.heroEyebrow = hero.heroEyebrow;
    site.heroTitle = hero.heroTitle;
    site.heroDescription = hero.heroDescription;
    site.heroCtaLabel = hero.heroCtaLabel;
  }

  const directory = readSetting("directory", values);
  if (directory) {
    site.directoryEyebrow = directory.directoryEyebrow;
    site.directoryTitle = directory.directoryTitle;
    site.directoryDescription = directory.directoryDescription;
  }

  const contact = readSetting("contact", values);
  if (contact) {
    site.contactEyebrow = contact.contactEyebrow;
    site.contactTitle = contact.contactTitle;
    site.contactDescription = contact.contactDescription;
    site.contactCtaLabel = contact.contactCtaLabel;
    site.contactPendingLabel = contact.contactPendingLabel;
    site.contactEmail = contact.contactEmail;
  }

  const footer = readSetting("footer", values);
  if (footer) {
    site.footerTagline = footer.footerTagline;
    site.copyrightName = footer.copyrightName;
  }

  return site;
}

function buildCategories(records: PublicCategoryRecord[] | null): PublicCategory[] {
  if (records === null) {
    return [];
  }

  return records
    .map(toPublicCategory)
    .filter((category): category is PublicCategory => category !== null);
}

/**
 * Pure composition step: turns raw records and settings rows into the public
 * page DTO. `null` for either side means "query unavailable", which yields the
 * documented fallback behaviour (empty directory and branding copy).
 *
 * Exported so publication and shaping rules can be tested without a database.
 */
export function composePublicContent(
  records: PublicCategoryRecord[] | null,
  values: Record<string, unknown> | null,
): PublicPageContent {
  const categories = buildCategories(records);
  const site = buildSiteContent(values);
  const linkCount = categories.reduce((count, category) => count + category.links.length, 0);

  return { site, categories, isEmpty: linkCount === 0 };
}

/**
 * Loads everything the public page renders.
 *
 * Never throws for infrastructure or data problems: a database failure returns
 * an empty directory plus documented fallback branding, and the route shows an
 * explicit empty/error state instead of stale content.
 */
export async function getPublicContent(): Promise<{
  content: PublicPageContent;
  available: boolean;
}> {
  const [categoriesResult, settingsResult] = await Promise.all([
    cachedPublicCategories(),
    cachedSiteSettings(),
  ]);

  return {
    content: composePublicContent(
      categoriesResult.ok ? categoriesResult.data : null,
      settingsResult.ok ? settingsResult.data : null,
    ),
    available: categoriesResult.ok && settingsResult.ok,
  };
}

/** Public site copy without link data. */
export async function getPublicSiteContent(): Promise<PublicSiteContent> {
  const result = await cachedSiteSettings();

  return buildSiteContent(result.ok ? result.data : null);
}

/** Public categories with published, active links only. */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  const result = await cachedPublicCategories();

  return buildCategories(result.ok ? result.data : null);
}

/** Raw validated setting value for one key, for metadata and diagnostics. */
export async function getSiteSettingValue<K extends SiteSettingKey>(key: K) {
  const result = await cachedSiteSettings();

  if (!result.ok || result.data[key] === undefined) {
    return { ok: false as const };
  }

  try {
    return { ok: true as const, value: parseSiteSetting(key, result.data[key]) };
  } catch (error) {
    logContentFailure(`site setting "${key}" failed validation`, error);

    return { ok: false as const };
  }
}

/** True when the public content query succeeded. Used by diagnostics and tests. */
export async function isPublicContentAvailable(): Promise<boolean> {
  const [categories, settings] = await Promise.all([cachedPublicCategories(), cachedSiteSettings()]);

  return categories.ok && settings.ok;
}
