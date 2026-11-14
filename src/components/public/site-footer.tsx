import Image from "next/image";

import { publicAnchors, siteContent } from "@/features/public/content";

export default function SiteFooter({ year }: { year: number }) {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <div className="footer-brand">
          <Image
            alt=""
            className="footer-brand__logo"
            height={32}
            src="/assets/flexbox-logo.png"
            width={32}
          />
          <div className="footer-brand__text">
            <p className="footer-brand__name">{siteContent.name}</p>
            <p className="footer-brand__tagline">{siteContent.footerTagline}</p>
          </div>
        </div>

        <nav aria-label="Navigasi footer" className="footer-nav">
          <a href={publicAnchors.directory}>{siteContent.headerNavLabel}</a>
          <a href={publicAnchors.contact}>{siteContent.contactNavLabel}</a>
        </nav>

        <p className="footer-copyright">
          © {year} {siteContent.copyrightName}
        </p>
      </div>
    </footer>
  );
}