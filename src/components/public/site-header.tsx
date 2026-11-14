import Image from "next/image";

import { publicAnchors, siteContent } from "@/features/public/content";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <a className="brand" href={publicAnchors.top}>
          <Image
            alt=""
            className="brand__logo"
            height={38}
            priority
            sizes="37px"
            src="/assets/flexbox-logo.png"
            width={36}
          />
          <span className="brand__text">
            <span className="brand__wordmark">{siteContent.wordmark}</span>
            <span className="brand__suffix">{siteContent.wordmarkSuffix}</span>
          </span>
          <span className="brand__label">{siteContent.supportingLabel}</span>
        </a>

        <nav aria-label="Navigasi utama" className="site-nav">
          <a className="site-nav__link" href={publicAnchors.directory}>
            {siteContent.headerNavLabel}
          </a>
          <a className="site-nav__cta" href={publicAnchors.contact}>
            {siteContent.headerCtaLabel}
            <span aria-hidden="true" className="site-nav__cta-arrow">
              ↗
            </span>
          </a>
        </nav>
      </div>
    </header>
  );
}