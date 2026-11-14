import Hero from "@/components/public/hero";
import SiteHeader from "@/components/public/site-header";

/**
 * Public microsite — Flexbox Studio Digital Hub.
 *
 * Phase 2 renders from the in-repository content configuration. Later phases
 * replace it with database-backed queries while keeping the same component
 * interface, so presentation components stay unchanged.
 */
export default function PublicPage() {
  return (
    <div id="atas">
      <a className="skip-link" href="#konten">
        Lewati ke konten utama
      </a>

      <SiteHeader />

      <main id="konten">
        <Hero />
      </main>
    </div>
  );
}