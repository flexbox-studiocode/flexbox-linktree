import Image from "next/image";

import { publicAnchors } from "@/features/content/constants";
import type { PublicSiteContent } from "@/features/content/types/public-content";

type SiteHeaderProps = {
  site: Pick<PublicSiteContent, "wordmark" | "wordmarkSuffix" | "supportingLabel" | "headerNavLabel" | "headerCtaLabel">;
};

export default function SiteHeader({ site }: SiteHeaderProps) {
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
            <span className="brand__wordmark">{site.wordmark}</span>
            <span className="brand__suffix">{site.wordmarkSuffix}</span>
          </span>
          <span className="brand__label">{site.supportingLabel}</span>
        </a>

        <nav aria-label="Navigasi utama" className="site-nav">
          <a className="site-nav__link" href={publicAnchors.directory}>
            {site.headerNavLabel}
          </a>
          <a className="site-nav__cta" href={publicAnchors.contact}>
            {site.headerCtaLabel}
            <span aria-hidden="true" className="site-nav__cta-arrow">
              ↗
            </span>
          </a>
        </nav>
      </div>
    </header>
  );
}
