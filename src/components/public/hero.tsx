import { publicAnchors } from "@/features/content/constants";
import type { PublicSiteContent } from "@/features/content/types/public-content";

type HeroProps = {
  site: Pick<
    PublicSiteContent,
    "name" | "heroEyebrow" | "heroTitle" | "heroDescription" | "heroCtaLabel"
  >;
};

export default function Hero({ site }: HeroProps) {
  return (
    <section aria-labelledby="hero-title" className="hero">
      <div className="hero__stripe" aria-hidden="true">
        <span className="hero__stripe-label">{site.name}</span>
        <span className="hero__stripe-rule" />
        <span className="hero__stripe-label">Direktori digital</span>
      </div>

      <div className="hero__grid">
        <div aria-hidden="true" className="hero__mark">
          <span className="hero__mark-cell hero__mark-cell--blue" />
          <span className="hero__mark-cell hero__mark-cell--graphite" />
          <span className="hero__mark-cell hero__mark-cell--outline" />
          <span className="hero__mark-cell hero__mark-cell--blue" />
        </div>

        <div className="hero__content">
          <p className="eyebrow">{site.heroEyebrow}</p>
          <h1 className="hero__title" id="hero-title">
            {site.heroTitle}
          </h1>
          <p className="hero__description">{site.heroDescription}</p>
          <a className="hero__cta" href={publicAnchors.directory}>
            {site.heroCtaLabel}
            <span aria-hidden="true" className="hero__cta-arrow">
              ↓
            </span>
          </a>
        </div>

        <p aria-hidden="true" className="hero__note">
          Delapan tujuan
          <br />
          satu direktori
        </p>
      </div>
    </section>
  );
}
