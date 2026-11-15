import { z } from "zod";

import { isAllowedDestinationUrl } from "@/lib/utils/url";

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

export const siteSettingSchemas = {
  general: z.object({
    name: nonEmptyText(120),
    wordmark: nonEmptyText(80),
    wordmarkSuffix: nonEmptyText(80),
    supportingLabel: nonEmptyText(120),
  }).strict(),
  navigation: z.object({
    headerNavLabel: nonEmptyText(80),
    contactNavLabel: nonEmptyText(80),
    headerCtaLabel: nonEmptyText(80),
  }).strict(),
  hero: z.object({
    heroEyebrow: nonEmptyText(120),
    heroTitle: nonEmptyText(180),
    heroDescription: nonEmptyText(500),
    heroCtaLabel: nonEmptyText(100),
  }).strict(),
  directory: z.object({
    directoryEyebrow: nonEmptyText(120),
    directoryTitle: nonEmptyText(160),
    directoryDescription: nonEmptyText(300),
  }).strict(),
  contact: z.object({
    contactEyebrow: nonEmptyText(120),
    contactTitle: nonEmptyText(160),
    contactDescription: nonEmptyText(500),
    contactCtaLabel: nonEmptyText(100),
    contactPendingLabel: nonEmptyText(160),
    contactEmail: z.string().email().nullable(),
  }).strict(),
  footer: z.object({
    footerTagline: nonEmptyText(200),
    copyrightName: nonEmptyText(120),
  }).strict(),
  seo: z.object({
    title: nonEmptyText(160),
    description: nonEmptyText(320),
    canonicalUrl: z.string().url().refine((value) => isAllowedDestinationUrl(value), "Use an approved HTTP(S) URL.").nullable(),
    openGraphImage: z.string().url().refine((value) => isAllowedDestinationUrl(value), "Use an approved HTTP(S) URL.").nullable(),
  }).strict(),
} as const;

export type SiteSettingKey = keyof typeof siteSettingSchemas;
export type SiteSettingValue<K extends SiteSettingKey> = z.infer<(typeof siteSettingSchemas)[K]>;

export function parseSiteSetting<K extends SiteSettingKey>(key: K, value: unknown): SiteSettingValue<K> {
  return siteSettingSchemas[key].parse(value) as SiteSettingValue<K>;
}
