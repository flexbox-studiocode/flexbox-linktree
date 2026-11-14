import { publicAnchors, siteContent } from "@/features/public/content";

export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hero">
      <div className="hero__stripe" aria-hidden="true">
        <span className="hero__stripe-label">{siteContent.name}</span>
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
          <p className="eyebrow">{siteContent.heroEyebrow}</p>
          <h1 className="hero__title" id="hero-title">
            {siteContent.heroTitle}
          </h1>
          <p className="hero__description">{siteContent.heroDescription}</p>
          <a className="hero__cta" href={publicAnchors.directory}>
            {siteContent.heroCtaLabel}
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