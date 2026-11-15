import { z } from "zod";

/**
 * Query-parameter parsing for the CMS list screens.
 *
 * Admin list screens read `searchParams`, which is untrusted request input, so
 * every value is parsed and bounded before it reaches a database query. Parsing
 * never throws: an invalid value falls back to the documented default so a
 * malformed URL renders an empty/filtered list instead of an error page.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PageParams = {
  page: number;
  pageSize: number;
};

const positiveInt = z.coerce.number().int().min(1);

export function parsePageParams(input: {
  page?: string | string[] | undefined;
  pageSize?: string | string[] | undefined;
}): PageParams {
  const rawPage = first(input.page);
  const rawSize = first(input.pageSize);

  const page = positiveInt.safeParse(rawPage ?? 1);
  const size = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).safeParse(rawSize ?? DEFAULT_PAGE_SIZE);

  return {
    page: page.success ? page.data : 1,
    pageSize: size.success ? size.data : DEFAULT_PAGE_SIZE,
  };
}

/** Returns the first value of a repeated query parameter. */
export function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

/** Trims and length-bounds an optional free-text filter. */
export function parseSearchTerm(value: string | string[] | undefined, max = 120): string {
  const raw = first(value)?.trim() ?? "";

  return raw.slice(0, max);
}

export const linkStatusFilterSchema = z.enum(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"]);
export type LinkStatusFilter = z.infer<typeof linkStatusFilterSchema>;

export function parseLinkStatusFilter(value: string | string[] | undefined): LinkStatusFilter {
  const parsed = linkStatusFilterSchema.safeParse(first(value));

  return parsed.success ? parsed.data : "ALL";
}

export const activeFilterSchema = z.enum(["ALL", "ACTIVE", "INACTIVE"]);
export type ActiveFilter = z.infer<typeof activeFilterSchema>;

export function parseActiveFilter(value: string | string[] | undefined): ActiveFilter {
  const parsed = activeFilterSchema.safeParse(first(value));

  return parsed.success ? parsed.data : "ALL";
}

/** `1` is page 1; renders an ellipsis-aware window of pages around the current one. */
export function pageWindow(page: number, pageCount: number, radius = 2): number[] {
  if (pageCount <= 0) {
    return [];
  }

  const start = Math.max(1, page - radius);
  const end = Math.min(pageCount, page + radius);
  const pages: number[] = [];

  for (let index = start; index <= end; index += 1) {
    pages.push(index);
  }

  return pages;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `YYYY-MM-DD` bound.
 *
 * `endOfDay` moves the bound to 23:59:59.999 so an inclusive "to" date includes
 * that whole day. Invalid input returns `undefined` rather than throwing.
 */
export function parseDateBound(
  value: string | string[] | undefined,
  edge: "start" | "end" = "start",
): Date | undefined {
  const raw = first(value)?.trim();

  if (!raw || !ISO_DATE.test(raw)) {
    return undefined;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (edge === "end") {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

/** Whitelists a free-text id filter; anything not a UUID is dropped. */
export function parseOptionalId(value: string | string[] | undefined): string | undefined {
  const parsed = z.uuid().safeParse(first(value));

  return parsed.success ? parsed.data : undefined;
}
