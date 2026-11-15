import LinkIcon from "@/components/public/link-icon";
import type { PublicSiteContent } from "@/features/content/types/public-content";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactCtaProps = {
  site: Pick<
    PublicSiteContent,
    | "contactEyebrow"
    | "contactTitle"
    | "contactDescription"
    | "contactCtaLabel"
    | "contactPendingLabel"
    | "contactEmail"
  >;
};

export default function ContactCta({ site }: ContactCtaProps) {
  const hasVerifiedDestination =
    site.contactEmail !== null && EMAIL_PATTERN.test(site.contactEmail);

  return (
    <section aria-labelledby="contact-title" className="contact" id="kontak">
      <div className="contact__icon" aria-hidden="true">
        <LinkIcon className="contact__icon-svg" name="mail" />
      </div>

      <div className="contact__content">
        <p className="eyebrow">{site.contactEyebrow}</p>
        <h2 className="contact__title" id="contact-title">
          {site.contactTitle}
        </h2>
        <p className="contact__description">{site.contactDescription}</p>
      </div>

      <div className="contact__action">
        {hasVerifiedDestination ? (
          <a className="contact__link" href={`mailto:${site.contactEmail}`}>
            {site.contactCtaLabel}
            <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <p className="contact__pending">
            <span aria-hidden="true" className="contact__pending-dot" />
            {site.contactPendingLabel}
          </p>
        )}
      </div>
    </section>
  );
}
