import LinkIcon from "@/components/public/link-icon";
import { contactEmail } from "@/features/public/contact";
import { siteContent } from "@/features/public/content";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactCta() {
  const hasVerifiedDestination =
    contactEmail !== null && EMAIL_PATTERN.test(contactEmail);

  return (
    <section aria-labelledby="contact-title" className="contact" id="kontak">
      <div className="contact__icon" aria-hidden="true">
        <LinkIcon className="contact__icon-svg" name="mail" />
      </div>

      <div className="contact__content">
        <p className="eyebrow">{siteContent.contactEyebrow}</p>
        <h2 className="contact__title" id="contact-title">
          {siteContent.contactTitle}
        </h2>
        <p className="contact__description">{siteContent.contactDescription}</p>
      </div>

      <div className="contact__action">
        {hasVerifiedDestination ? (
          <a className="contact__link" href={`mailto:${contactEmail}`}>
            {siteContent.contactCtaLabel}
            <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <p className="contact__pending">
            <span aria-hidden="true" className="contact__pending-dot" />
            {siteContent.contactPendingLabel}
          </p>
        )}
      </div>
    </section>
  );
}