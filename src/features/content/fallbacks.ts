import type { PublicSiteContent } from "@/features/content/types/public-content";

/**
 * Emergency branding copy.
 *
 * These values already exist as approved public copy; nothing here is invented.
 * They are used only when the database is unreachable or a stored site setting
 * fails validation, so that a database incident degrades to a branded shell
 * with an explicit empty/error state.
 *
 * Policy: link data is NEVER substituted from this module. A database failure
 * always yields an empty directory, never stale static links, no unpublished
 * record, and no destination that the owner has not verified.
 */
export const fallbackSiteContent: PublicSiteContent = {
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
  contactEmail: null,
  footerTagline: "Ide fleksibel. Karya nyata.",
  copyrightName: "Flexbox Studio",
};
