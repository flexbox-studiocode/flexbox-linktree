/**
 * Public content DTOs.
 *
 * These are the only shapes the public components receive. Prisma model types
 * must never leak into presentation code, and these types deliberately contain
 * no admin-only fields (status, publication timestamp, internal ids, audit
 * metadata). `href` is omitted unless a destination has been verified.
 */
export type PublicLinkIcon =
  | "grid"
  | "spark"
  | "globe"
  | "book"
  | "shape"
  | "community"
  | "mail";

/** Where a card points, restricted to what a visitor may safely navigate to. */
export type PublicDestination =
  | { kind: "external"; href: string }
  | { kind: "internal"; href: string }
  | { kind: "none" };

export type PublicLink = {
  /** Stable UI key (the public slug). */
  id: string;
  /** Database id used by the server-resolved tracking redirect. */
  linkId: string;
  title: string;
  description: string;
  icon: PublicLinkIcon;
  href?: string;
  tag?: string;
  isFeatured: boolean;
  sortOrder: number;
};

export type PublicCategory = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  links: PublicLink[];
};

export type PublicSiteContent = {
  name: string;
  wordmark: string;
  wordmarkSuffix: string;
  supportingLabel: string;
  headerNavLabel: string;
  contactNavLabel: string;
  headerCtaLabel: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroCtaLabel: string;
  directoryEyebrow: string;
  directoryTitle: string;
  directoryDescription: string;
  contactEyebrow: string;
  contactTitle: string;
  contactDescription: string;
  contactCtaLabel: string;
  contactPendingLabel: string;
  /** `null` until the owner confirms a real, monitored mailbox. */
  contactEmail: string | null;
  footerTagline: string;
  copyrightName: string;
};

export type PublicPageContent = {
  site: PublicSiteContent;
  categories: PublicCategory[];
  /** True when the database held no eligible public links at all. */
  isEmpty: boolean;
};
