import { fallbackSiteContent } from "@/features/content/fallbacks";
import { siteSettingSchemas } from "@/features/content/schemas/site-setting";
import type { SiteSettingKey, SiteSettingValue } from "@/features/content/schemas/site-setting";

/**
 * Reconciles stored site settings with the approved fallback copy so the CMS
 * always renders a complete, valid form.
 *
 * - A stored value that passes its schema wins.
 * - A missing or invalid stored value falls back to the documented public copy,
 *   so a partially seeded database never produces an empty settings screen.
 *
 * The output shape matches `siteSettingSchemas` exactly and is safe to send to a
 * Client Component because it contains no database metadata.
 */
export type SettingsFormValues = {
  [K in SiteSettingKey]: Record<string, string | null>;
};

export function buildSettingsFormValues(stored: Record<string, unknown>): SettingsFormValues {
  const general = fallbackSiteContent;

  const defaults: Record<SiteSettingKey, Record<string, string | null>> = {
    general: {
      name: general.name,
      wordmark: general.wordmark,
      wordmarkSuffix: general.wordmarkSuffix,
      supportingLabel: general.supportingLabel,
    },
    navigation: {
      headerNavLabel: general.headerNavLabel,
      contactNavLabel: general.contactNavLabel,
      headerCtaLabel: general.headerCtaLabel,
    },
    hero: {
      heroEyebrow: general.heroEyebrow,
      heroTitle: general.heroTitle,
      heroDescription: general.heroDescription,
      heroCtaLabel: general.heroCtaLabel,
    },
    directory: {
      directoryEyebrow: general.directoryEyebrow,
      directoryTitle: general.directoryTitle,
      directoryDescription: general.directoryDescription,
    },
    contact: {
      contactEyebrow: general.contactEyebrow,
      contactTitle: general.contactTitle,
      contactDescription: general.contactDescription,
      contactCtaLabel: general.contactCtaLabel,
      contactPendingLabel: general.contactPendingLabel,
      contactEmail: general.contactEmail,
    },
    footer: {
      footerTagline: general.footerTagline,
      copyrightName: general.copyrightName,
    },
    seo: {
      title: `${general.name} — Digital Hub`,
      description: general.supportingLabel,
      canonicalUrl: null,
      openGraphImage: null,
    },
  };

  const result = { ...defaults } as SettingsFormValues;

  for (const key of Object.keys(siteSettingSchemas) as SiteSettingKey[]) {
    const parsed = siteSettingSchemas[key].safeParse(stored[key]);

    if (parsed.success) {
      result[key] = parsed.data as SiteSettingValue<SiteSettingKey> as Record<string, string | null>;
    }
  }

  return result;
}
