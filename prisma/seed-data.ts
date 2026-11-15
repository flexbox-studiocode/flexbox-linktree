import type { PublicLinkIcon } from "../src/features/content/types/public-content";

/**
 * Canonical development seed dataset.
 *
 * This mirrors the approved Phase 2 public content exactly: two editorial
 * categories, eight curated links, the original descriptions, icon names and
 * ordering, and the site-wide copy. No destination is invented here — the six
 * unconfirmed links carry no destination at all and stay non-interactive.
 *
 * It is the single source of truth for a local/demo dataset. `prisma/seed.ts`
 * upserts it by natural key, so running the seed repeatedly is a no-op.
 * `tests/unit/seed-data.test.ts` verifies this file against the content
 * validation schemas.
 */

export type SeedLink = {
  slug: string;
  title: string;
  description: string;
  icon: PublicLinkIcon;
  sortOrder: number;
  /** Internal anchor only; external URLs stay unset until the owner verifies them. */
  href?: string;
  tag?: string;
  isFeatured?: boolean;
};

export type SeedCategory = {
  name: string;
  slug: string;
  sortOrder: number;
  links: SeedLink[];
};

export const seedCategories: SeedCategory[] = [
  {
    name: "Pilihan studio",
    slug: "studio-picks",
    sortOrder: 1,
    links: [
      {
        slug: "flexbox-design-system",
        title: "Flexbox Design System",
        description: "Sistem visual dan prinsip desain yang menyatukan karya Flexbox.",
        icon: "grid",
        tag: "Segera",
        isFeatured: true,
        sortOrder: 1,
      },
      {
        slug: "flexbox-lab",
        title: "Flexbox Lab",
        description: "Ruang uji untuk ide, prototipe, dan kemungkinan baru.",
        icon: "spark",
        tag: "Segera",
        sortOrder: 2,
      },
      {
        slug: "website-flexbox",
        title: "Website Flexbox",
        description: "Cerita, layanan, dan karya digital Flexbox Studio.",
        icon: "globe",
        tag: "Segera",
        sortOrder: 3,
      },
      {
        slug: "sumber-daya",
        title: "Sumber Daya",
        description: "Referensi, catatan, dan bahan yang membantu proses berkarya.",
        icon: "book",
        tag: "Segera",
        sortOrder: 4,
      },
    ],
  },
  {
    name: "Jelajahi lebih jauh",
    slug: "explore-more",
    sortOrder: 2,
    links: [
      {
        slug: "karya-digital",
        title: "Karya Digital",
        description: "Kumpulan proyek digital pilihan dari studio.",
        icon: "shape",
        tag: "Segera",
        sortOrder: 5,
      },
      {
        slug: "eksperimen-visual",
        title: "Eksperimen Visual",
        description: "Catatan visual dari proses eksplorasi dan percobaan studio.",
        icon: "spark",
        tag: "Segera",
        sortOrder: 6,
      },
      {
        slug: "terhubung",
        title: "Terhubung dengan Kami",
        description: "Punya pertanyaan atau ingin menyapa? Mulai dari sini.",
        icon: "community",
        href: "#kontak",
        sortOrder: 7,
      },
      {
        slug: "kolaborasi",
        title: "Kolaborasi & Kemitraan",
        description: "Buka percakapan untuk membangun sesuatu bersama.",
        icon: "mail",
        href: "#kontak",
        sortOrder: 8,
      },
    ],
  },
];

/** Site-setting seed values, keyed exactly as `siteSettingSchemas` expects. */
export const seedSiteSettings = {
  general: {
    name: "Flexbox Studio",
    wordmark: "Flexbox",
    wordmarkSuffix: "Studio",
    supportingLabel: "Digital directory",
  },
  navigation: {
    headerNavLabel: "Jelajahi",
    contactNavLabel: "Kontak",
    headerCtaLabel: "Mari terhubung",
  },
  hero: {
    heroEyebrow: "Digital hub / Direktori 01",
    heroTitle: "Ide fleksibel. Karya nyata.",
    heroDescription:
      "Satu pintu menuju produk, proyek, sumber daya, dan kanal komunitas Flexbox Studio.",
    heroCtaLabel: "Jelajahi direktori",
  },
  directory: {
    directoryEyebrow: "01 / Direktori",
    directoryTitle: "Jelajahi Flexbox",
    directoryDescription: "Delapan tujuan utama, dikurasi agar mudah dipindai.",
  },
  contact: {
    contactEyebrow: "02 / Kontak",
    contactTitle: "Punya ide untuk diwujudkan?",
    contactDescription:
      "Mari membuka percakapan dan menemukan kemungkinan kolaborasi berikutnya.",
    contactCtaLabel: "Mulai percakapan",
    contactPendingLabel: "Kanal kontak segera dipublikasikan",
    // Unpublished on purpose: the owner has not confirmed a monitored mailbox.
    contactEmail: null,
  },
  footer: {
    footerTagline: "Ide fleksibel. Karya nyata.",
    copyrightName: "Flexbox Studio",
  },
  seo: {
    title: "Flexbox Studio — Digital Hub",
    description:
      "Direktori digital Flexbox Studio: produk, proyek, sumber daya, komunitas, dan kontak dalam satu tempat.",
    // Both stay null until a verified production domain and artwork exist.
    canonicalUrl: null,
    openGraphImage: null,
  },
} as const;

/** Fixed publication timestamp keeps the seed deterministic. */
export const seedPublishedAt = "2026-01-01T00:00:00.000Z";
