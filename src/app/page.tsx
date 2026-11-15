import { copyrightYear } from "@/features/public/copyright";
import { getPublicContent } from "@/features/content/services/content";

import ContactCta from "@/components/public/contact-cta";
import Directory from "@/components/public/directory";
import Hero from "@/components/public/hero";
import SiteFooter from "@/components/public/site-footer";
import SiteHeader from "@/components/public/site-header";

/**
 * Public microsite — Flexbox Studio Digital Hub.
 *
 * Content is loaded server-side from PostgreSQL through the content service,
 * which returns published, active records only. A database failure degrades to
 * an explicit empty directory plus documented branding copy; it never falls
 * back to unpublished or static link data.
 */
export default async function PublicPage() {
  const { content } = await getPublicContent();
  const { site, categories } = content;

  return (
    <div id="atas">
      <a className="skip-link" href="#konten">
        Lewati ke konten utama
      </a>

      <SiteHeader site={site} />

      <main id="konten">
        <Hero site={site} />
        <Directory
          categories={categories}
          directoryDescription={site.directoryDescription}
          directoryEyebrow={site.directoryEyebrow}
          directoryTitle={site.directoryTitle}
        />
        <ContactCta site={site} />
      </main>

      <SiteFooter site={site} year={copyrightYear} />
    </div>
  );
}
