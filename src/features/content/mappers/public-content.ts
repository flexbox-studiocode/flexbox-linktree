import "server-only";

import type { Category, Link } from "@/generated/prisma/client";
import { publicAnchors } from "@/features/content/constants";
import type {
  PublicCategory,
  PublicLink,
  PublicLinkIcon,
} from "@/features/content/types/public-content";
import { getDestinationKind, isAllowedDestinationUrl } from "@/lib/utils/url";

const KNOWN_ICONS: ReadonlySet<PublicLinkIcon> = new Set([
  "grid",
  "spark",
  "globe",
  "book",
  "shape",
  "community",
  "mail",
]);

const FALLBACK_ICON: PublicLinkIcon = "grid";

const APPROVED_ANCHORS: ReadonlySet<string> = new Set(Object.values(publicAnchors));

export type PublicCategoryRecord = Category & { links: Link[] };

/**
 * Resolves the visitor-facing destination for a link.
 *
 * Returns `{ kind: "none" }` for a deliberate `NONE` destination and also for
 * an EXTERNAL/INTERNAL value that fails validation. A link can therefore never
 * become a clickable card by accident; the card renders as the non-interactive
 * `Segera` state instead.
 */
export function resolveDestination(link: Link):
  | { kind: "external"; href: string }
  | { kind: "internal"; href: string }
  | { kind: "none" } {
  if (link.destinationType === "EXTERNAL") {
    const href = link.destinationUrl?.trim();

    if (!href || !isAllowedDestinationUrl(href) || getDestinationKind(href) === null) {
      return { kind: "none" };
    }

    return { kind: "external", href };
  }

  if (link.destinationType === "INTERNAL") {
    const anchor = link.internalAnchor?.trim();

    if (!anchor || !APPROVED_ANCHORS.has(anchor)) {
      return { kind: "none" };
    }

    return { kind: "internal", href: anchor };
  }

  return { kind: "none" };
}

/** Maps a database link to the public DTO, dropping every admin-only field. */
export function toPublicLink(link: Link): PublicLink {
  const destination = resolveDestination(link);
  const icon = link.icon && KNOWN_ICONS.has(link.icon as PublicLinkIcon)
    ? (link.icon as PublicLinkIcon)
    : FALLBACK_ICON;

  return {
    id: link.slug,
    title: link.title,
    description: link.description ?? "",
    icon,
    ...(destination.kind === "none" ? {} : { href: destination.href }),
    ...(link.tag ? { tag: link.tag } : {}),
    isFeatured: link.isFeatured,
    sortOrder: link.sortOrder,
  };
}

/**
 * Maps a category with its links. Categories without public links are dropped
 * so the public page never renders an empty section.
 */
export function toPublicCategory(record: PublicCategoryRecord): PublicCategory | null {
  const links = record.links.map(toPublicLink);

  if (links.length === 0) {
    return null;
  }

  return {
    id: record.slug,
    title: record.name,
    slug: record.slug,
    sortOrder: record.sortOrder,
    links,
  };
}
