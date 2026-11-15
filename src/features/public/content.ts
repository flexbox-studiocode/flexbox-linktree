/**
 * Public page content for Phase 2.
 *
 * Phase 2 renders from this typed, in-repository configuration. The CMS in a
 * later phase will replace this module with database-backed queries, so keep
 * data here and presentation in `src/components/public/`.
 *
 * Destination policy: no URL, email address, or social handle may be invented.
 * Links without a confirmed destination keep `href` unset and carry a `tag`
 * that tells visitors the destination is not published yet.
 */

export type LinkIconName =
  | "grid"
  | "spark"
  | "globe"
  | "book"
  | "shape"
  | "community"
  | "mail";

export type LinkItem = {
  id: string;
  title: string;
  description: string;
  /** Slug of the owning category. */
  category: string;
  icon: LinkIconName;
  /** Omit until the owner confirms the real destination. */
  href?: string;
  tag?: string;
  isFeatured?: boolean;
  sortOrder: number;
};

export type LinkCategory = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  links: LinkItem[];
};

export const publicCategories: LinkCategory[] = [
  {
    id: "studio-picks",
    title: "Pilihan studio",
    slug: "studio-picks",
    sortOrder: 1,
    links: [
      {
        id: "flexbox-design-system",
        title: "Flexbox Design System",
        description: "Sistem visual dan prinsip desain yang menyatukan karya Flexbox.",
        category: "studio-picks",
        icon: "grid",
        tag: "Segera",
        isFeatured: true,
        sortOrder: 1,
      },
      {
        id: "flexbox-lab",
        title: "Flexbox Lab",
        description: "Ruang uji untuk ide, prototipe, dan kemungkinan baru.",
        category: "studio-picks",
        icon: "spark",
        tag: "Segera",
        sortOrder: 2,
      },
      {
        id: "website-flexbox",
        title: "Website Flexbox",
        description: "Cerita, layanan, dan karya digital Flexbox Studio.",
        category: "studio-picks",
        icon: "globe",
        tag: "Segera",
        sortOrder: 3,
      },
      {
        id: "sumber-daya",
        title: "Sumber Daya",
        description: "Referensi, catatan, dan bahan yang membantu proses berkarya.",
        category: "studio-picks",
        icon: "book",
        tag: "Segera",
        sortOrder: 4,
      },
    ],
  },
  {
    id: "explore-more",
    title: "Jelajahi lebih jauh",
    slug: "explore-more",
    sortOrder: 2,
    links: [
      {
        id: "karya-digital",
        title: "Karya Digital",
        description: "Kumpulan proyek digital pilihan dari studio.",
        category: "explore-more",
        icon: "shape",
        tag: "Segera",
        sortOrder: 5,
      },
      {
        id: "eksperimen-visual",
        title: "Eksperimen Visual",
        description: "Catatan visual dari proses eksplorasi dan percobaan studio.",
        category: "explore-more",
        icon: "spark",
        tag: "Segera",
        sortOrder: 6,
      },
      {
        id: "terhubung",
        title: "Terhubung dengan Kami",
        description: "Punya pertanyaan atau ingin menyapa? Mulai dari sini.",
        category: "explore-more",
        icon: "community",
        href: "#kontak",
        sortOrder: 7,
      },
      {
        id: "kolaborasi",
        title: "Kolaborasi & Kemitraan",
        description: "Buka percakapan untuk membangun sesuatu bersama.",
        category: "explore-more",
        icon: "mail",
        href: "#kontak",
        sortOrder: 8,
      },
    ],
  },
];

export const siteContent = {
  name: "Flexbox Studio",
  wordmark: "Flexbox",
  wordmarkSuffix: "Studio",
  supportingLabel: "Digital directory",
  headerNavLabel: "Jelajahi",
  contactNavLabel: "Kontak",
  headerCtaLabel: "Mari terhubung",
  heroEyebrow: "Digital hub / Direktori 01",
  heroTitle: "Ide fleksibel. Karya nyata.",
  heroDescription:
    "Satu pintu menuju produk, proyek, sumber daya, dan kanal komunitas Flexbox Studio.",
  heroCtaLabel: "Jelajahi direktori",
  directoryEyebrow: "01 / Direktori",
  directoryTitle: "Jelajahi Flexbox",
  directoryDescription: "Delapan tujuan utama, dikurasi agar mudah dipindai.",
  contactEyebrow: "02 / Kontak",
  contactTitle: "Punya ide untuk diwujudkan?",
  contactDescription:
    "Mari membuka percakapan dan menemukan kemungkinan kolaborasi berikutnya.",
  contactCtaLabel: "Mulai percakapan",
  contactPendingLabel: "Kanal kontak segera dipublikasikan",
  footerTagline: "Ide fleksibel. Karya nyata.",
  copyrightName: "Flexbox Studio",
} as const;

/** Navigation anchors reuse one source so header, hero, and footer stay in sync. */
export { publicAnchors } from "@/features/content/constants";