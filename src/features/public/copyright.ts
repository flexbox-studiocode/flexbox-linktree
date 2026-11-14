/**
 * Stable copyright year.
 *
 * The year is a static value because the public page is prerendered and this
 * project's Next.js version rejects `new Date()` during prerendering under
 * Cache Components. A fixed value keeps the route fully static (no per-request
 * render, no hydration mismatch). Refresh it when the published year changes.
 */
export const copyrightYear = 2026;
