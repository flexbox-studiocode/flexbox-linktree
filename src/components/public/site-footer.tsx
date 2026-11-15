import Image from "next/image";

import { publicAnchors } from "@/features/content/constants";
import type { PublicSiteContent } from "@/features/content/types/public-content";

type SiteFooterProps = {
  site: Pick<PublicSiteContent, "name" | "footerTagline" | "copyrightName" | "headerNavLabel" | "headerCtaLabel">;
  year: number;
};

export default function SiteFooter({ site, year }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <div className="footer-brand">
          <Image
            alt=""
            className="footer-brand__logo"
            height={36}
            sizes="34px"
            src="/assets/flexbox-logo.png"
            width={32}
          />
          <div className="footer-brand__text">
            <p className="footer-brand__name">{site.name}</p>
            <p className="footer-brand__tagline">{site.footerTagline}</p>
          </div>
        </div>

        <nav aria-label="Navigasi footer" className="footer-nav">
          <a className="footer-nav__link" href={publicAnchors.directory}>
            {site.headerNavLabel}
          </a>
          <a className="footer-nav__cta" href={publicAnchors.contact}>
            {site.headerCtaLabel}
            <span aria-hidden="true" className="footer-nav__cta-arrow">
              ↗
            </span>
          </a>
        </nav>

        <p className="footer-copyright">
          © {year} {site.copyrightName}
        </p>
      </div>
    </footer>
  );
}
