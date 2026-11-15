import LinkIcon from "@/components/public/link-icon";
import type { PublicLink as LinkItem } from "@/features/content/types/public-content";
import { getDestinationKind, isAllowedDestinationUrl } from "@/lib/utils/url";

type LinkCardProps = {
  item: LinkItem;
};

function CardBody({ item }: LinkCardProps) {
  return (
    <>
      <span className="link-card__icon" aria-hidden="false">
        <LinkIcon className="link-card__icon-svg" name={item.icon} />
      </span>
      <span className="link-card__body">
        <span className="link-card__heading">
          <span className="link-card__title">{item.title}</span>
          {item.tag ? <span className="link-card__tag">{item.tag}</span> : null}
        </span>
        <span className="link-card__description">{item.description}</span>
      </span>
      <span className="link-card__arrow" aria-hidden="true">
        ↗
      </span>
    </>
  );
}

/**
 * Whole-card anchor. A card without a confirmed destination renders as a
 * static, immediately-rendered panel so visitors never reach a broken or
 * invented URL.
 */
export default function LinkCard({ item }: LinkCardProps) {
  const href = item.href;

  if (!href || !isAllowedDestinationUrl(href)) {
    return (
      <div className="link-card link-card--pending">
        <CardBody item={item} />
      </div>
    );
  }

  const kind = getDestinationKind(href);
  const isExternal = kind === "web";

  return (
    <a
      className="link-card"
      href={isExternal ? `/go/${encodeURIComponent(item.linkId)}` : href}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : null)}
    >
      <CardBody item={item} />
      {isExternal ? (
        <span className="sr-only">(membuka tab baru)</span>
      ) : null}
    </a>
  );
}

export type { LinkCardProps };