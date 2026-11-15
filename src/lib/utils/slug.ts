/**
 * Converts arbitrary human text into a stable lowercase dash-separated slug.
 *
 * Used by the CMS to offer a default slug from a title. The value is not
 * trusted: the link/category schemas re-validate it before persistence, and
 * uniqueness is enforced by the database.
 */
export function slugify(input: string, maxLength = 120): string {
  const slug = input
    .normalize("NFKD")
    // Strip diacritics so "Eksperimen Visual" style text stays ASCII.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return slug;
}

/** Slug shape accepted by the content schemas. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= 160 && SLUG_PATTERN.test(value);
}
