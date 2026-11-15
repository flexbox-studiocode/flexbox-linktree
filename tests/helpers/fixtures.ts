import type { Category, Link } from "@/generated/prisma/client";
import type { LinkDestinationType, PublicationStatus } from "@/generated/prisma/enums";

let counter = 0;

function nextId(): string {
  counter += 1;

  return `00000000-0000-4000-8000-${counter.toString().padStart(12, "0")}`;
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  counter += 1;

  return {
    id: nextId(),
    name: `Category ${counter}`,
    slug: `category-${counter}`,
    description: null,
    icon: null,
    sortOrder: counter,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

type LinkOverrides = Partial<Omit<Link, "destinationType" | "status">> & {
  destinationType?: LinkDestinationType;
  status?: PublicationStatus;
};

export function makeLink(overrides: LinkOverrides = {}): Link {
  counter += 1;

  return {
    id: nextId(),
    slug: `link-${counter}`,
    categoryId: "00000000-0000-4000-8000-000000000001",
    title: `Link ${counter}`,
    description: `Description ${counter}`,
    icon: "grid",
    tag: null,
    destinationType: "NONE",
    destinationUrl: null,
    internalAnchor: null,
    status: "PUBLISHED",
    isActive: true,
    isFeatured: false,
    sortOrder: counter,
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
