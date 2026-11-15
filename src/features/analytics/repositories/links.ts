import "server-only";

import { isAllowedDestinationUrl, getDestinationKind } from "@/lib/utils/url";
import { prisma } from "@/lib/prisma/client";

/**
 * Link lookup for the tracking redirect.
 *
 * This is deliberately a fresh PostgreSQL read that re-applies the full public
 * eligibility rule on every request. A cached or stale row could keep an
 * archived/inactive link redirecting forever, so no `use cache` is involved.
 *
 * Returns `null` for every ineligible state, which the route maps to a 404-style
 * response rather than a redirect.
 */
export async function findTrackableLink(linkId: string): Promise<{
  linkId: string;
  slug: string;
  title: string;
  categoryName: string | null;
  destinationUrl: string;
} | null> {
  const row = await prisma.link.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      slug: true,
      title: true,
      destinationType: true,
      destinationUrl: true,
      status: true,
      isActive: true,
      category: { select: { isActive: true, name: true } },
    },
  });

  if (!row) {
    return null;
  }

  if (row.status !== "PUBLISHED") {
    return null;
  }

  if (!row.isActive) {
    return null;
  }

  if (!row.category || !row.category.isActive) {
    return null;
  }

  const destination = row.destinationUrl?.trim();

  if (row.destinationType !== "EXTERNAL" || !destination) {
    return null;
  }

  // Only a real web destination is eligible for the tracking redirect.
  if (!isAllowedDestinationUrl(destination) || getDestinationKind(destination) !== "web") {
    return null;
  }

  return {
    linkId: row.id,
    slug: row.slug,
    title: row.title,
    categoryName: row.category.name,
    destinationUrl: destination,
  };
}