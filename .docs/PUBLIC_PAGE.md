# Public User Page

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub
**Status:** Implemented in Phase 2; content source moved to PostgreSQL in Phase 3
**Language:** English

## 1. Scope

Phase 2 implements the public microsite only. Phase 3 keeps the presentation identical but replaces the static content module with published content loaded from PostgreSQL through `src/features/content`. The private Admin CMS, authentication, analytics collection, and deployment still belong to later roadmap phases (see `.docs/Roadmap.md`).

The public page is an editorial directory. It deliberately contains **no** public search, filter chips, pagination, or result counters, per `.docs/PRD.md` and `.docs/Desain.md`.

## 2. Page structure

`src/app/page.tsx` is the route and composes six sections in this order:

| Order | Section | Component | Landmark | Anchor |
|---|---|---|---|---|
| 1 | Header / navigation | `src/components/public/site-header.tsx` | `header` + `nav` | `#atas` (brand) |
| 2 | Hero | `src/components/public/hero.tsx` | `section` (`aria-labelledby="hero-title"`) | — |
| 3 | Editorial directory | `src/components/public/directory.tsx` | `section` | `#direktori` |
| 4 | Link cards | `src/components/public/link-card.tsx` | list items inside `ul` | — |
| 5 | Contact CTA | `src/components/public/contact-cta.tsx` | `section` | `#kontak` |
| 6 | Footer | `src/components/public/site-footer.tsx` | `footer` + `nav` | — |

`main` carries `id="konten"` and is the target of the skip link. A single `h1` exists (hero); section titles are `h2` and category titles are `h3`.

## 3. Content model

Content no longer lives in the presentation components. Since Phase 3 it is loaded from PostgreSQL:

- `src/features/content/services/content.ts` — `getPublicContent()` (cached, safe failure handling).
- `src/features/content/repositories/content.ts` — server-only Prisma queries that enforce publication and activation filters.
- `src/features/content/mappers/public-content.ts` — record → DTO mapping and destination resolution.
- `src/features/content/types/public-content.ts` — the DTOs the components receive.
- `src/features/content/constants.ts` — approved internal anchors.
- `prisma/seed-data.ts` — the development dataset (2 categories, 8 links, 7 settings).

```ts
export type PublicLink = {
  id: string;              // stable public slug
  title: string;
  description: string;
  icon: PublicLinkIcon;
  href?: string;           // omitted until the owner confirms the destination
  tag?: string;
  isFeatured: boolean;
  sortOrder: number;
};

export type PublicCategory = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  links: PublicLink[];
};
```

`src/app/page.tsx` awaits `getPublicContent()` and passes `site` and `categories` into the presentation components. Categories and links arrive already filtered by publication/activation state and already ordered by `{ sortOrder, slug }`, so no component-side sorting or filtering remains.

### What is never sent to a component

`status`, `publishedAt`, `isActive`, `categoryId`, database `id` values, and any audit metadata stay server-side. Drafts, archived links, inactive links, and links belonging to inactive categories are excluded in SQL.

### Empty and failure states

- No eligible links at all: the directory renders a short "content is being prepared" note inside the existing section, instead of empty category blocks.
- Database unavailable: the page still renders the brand shell using the documented fallback copy in `src/features/content/fallbacks.ts`, and the directory is empty. Static link data is **never** substituted, and no stack trace or credential is exposed to visitors.
- A missing or invalid individual site setting falls back per key; other settings still apply.

## 4. Link and destination policy

- Every rendered destination passes `isAllowedDestinationUrl()` from `src/lib/utils/url.ts` (HTTP/HTTPS only, plus `mailto:` where relevant). `javascript:`, `data:`, `vbscript:`, protocol-relative, and relative values are rejected.
- A card whose destination is not yet confirmed renders as a **static, non-interactive panel** with a visible `Segera` tag. It is never a link, so visitors cannot reach a broken or invented URL.
- Internal anchors (`#direktori`, `#kontak`, `#atas`) are allowed and validated against `publicAnchors`.
- External web destinations open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`, and the card text is followed by an accessible "(membuka tab baru)" note.
- The whole card is the anchor. No nested interactive elements.
- Icons are inline outline SVGs in `src/components/public/link-icon.tsx`, marked `aria-hidden="true"`. No emoji, no icon package.

### Unverified destinations (owner action required)

These items are intentionally published **without** a destination. The owner must confirm the real URLs before they become links:

| Item | Status |
|---|---|
| Flexbox Design System | No URL confirmed (`destinationType = NONE`) |
| Flexbox Lab | No URL confirmed (`destinationType = NONE`) |
| Website Flexbox | No URL confirmed (`destinationType = NONE`) |
| Sumber Daya | No URL confirmed (`destinationType = NONE`) |
| Karya Digital | No URL confirmed (`destinationType = NONE`) |
| Eksperimen Visual | No URL confirmed (`destinationType = NONE`) |

Since Phase 3, unblocking any of these is a **data** change: set `destinationType = EXTERNAL`, fill `destinationUrl`, and the card becomes an interactive link with no code change. The mapper still re-validates the stored URL and keeps the card non-interactive if the value is not an approved HTTP(S)/`mailto:` destination.

No email address, social handle, or external contact URL is published. The `contact.contactEmail` site setting is `null`; while it is `null`, the contact section shows the status label "Kanal kontak segera dipublikasikan" instead of a fake `mailto:` link. Setting it to a verified address switches the section to a real contact button with no other code change.

## 5. Design tokens and typography

`src/app/globals.css` holds the only public stylesheet (Tailwind v4 `@import "tailwindcss"` plus an `@theme` block and purpose-built class rules).

Palette (from `.docs/Desain.md`):

| Role | Value |
|---|---|
| Brand blue | `#3F83C4` |
| Light blue | `#D3DEF0` |
| Graphite | `#4E5460` |
| Page background | `#F7F9FC` |
| Surface | `#FFFFFF` |

Additional text/interaction values were derived from the palette to satisfy WCAG AA contrast and are intentionally limited to: `--ink` `#272E38`, `--muted` `#596574`, `--blue-strong` `#1F5F9D`, `--line` `#D7E0EC`, `--line-strong` `#B9C9DC`.

### Footer surface

The footer surface is **blue** rather than graphite, by owner decision, so the closing block reads as part of the Flexbox brand instead of a grey band. It uses `--blue-strong` `#1F5F9D` rather than the brand blue `#3F83C4`: white text on `#3F83C4` measures only 4.0:1, which is below the 4.5:1 requirement for the footer's 11–15px text. On `#1F5F9D` the footer text measures 6.6:1 (brand name and nav links), 5.31:1 (tagline), and 6.07:1 (copyright), so the WCAG 2.2 AA target still holds.

The footer navigation now mirrors the header: `Jelajahi` stays a plain white 14px/700 link, while `Mari terhubung` is rendered as a 14px/700 CTA card with a 6px radius. The CTA inverts the header card for contrast on the blue footer (white surface, `--blue-strong` text); its text contrast is 6.6:1. The tagline and copyright use white, with 600 weight, so they do not appear muted.

This is a deliberate deviation from the graphite-footer rule in `.docs/Desain.md` section 8.5, recorded here as an approved owner decision.

Typography:

- Display: **Anton** (approved) via `next/font/google`, self-hosted at build time.
- Body/navigation/cards: **Manrope** (approved fallback for the licensed Satoshi) via `next/font/google`.
- Satoshi is **not** included: the licensed font assets are not present in the repository and may not be downloaded from unofficial sources. Documented rather than silently substituted.
- Editorial metadata (eyebrows, category labels, tags, footer meta) uses the system monospace stack.

## 6. Responsive behaviour

- Shell: `min(100% - 40px, 880px)`, centred. 20px horizontal padding on mobile.
- Directory grid: one column below 600px, two columns from 600px. Never more than two.
- Hero: stacked mark + copy on mobile; a third editorial column appears at 900px.
- Header: brand + contact CTA on small screens; the "Jelajahi" nav link appears from 600px.
- Verified with zero horizontal overflow at 320, 390, 600, 768, 1024, 1280, and 1440px, and at 200% zoom.

## 7. Accessibility

- WCAG 2.2 AA target, verified by computed contrast checks (`pnpm qa:a11y`).
- Semantic `header`, `nav`, `main`, `section`, `footer`, one `h1`, no skipped heading levels.
- Skip link to `#konten`.
- Visible `:focus-visible` outline (3px) on light and dark surfaces.
- Touch targets are at least 44px tall for all controls.
- Icons are decorative (`aria-hidden`); every link has a text name; the logo image is decorative next to the visible wordmark.
- `prefers-reduced-motion: reduce` disables smooth scrolling and transitions.
- Anchor navigation uses `scroll-padding-top` so the sticky header never covers the target heading.

## 8. SEO and metadata

- `src/app/layout.tsx` (page title/description, Open Graph, Twitter `summary`, robots, `lang="id"`, theme color).
- `src/app/icon.png` — favicon generated from the brand logo.
- `src/app/robots.ts` — `/robots.txt`, allowing the public page and disallowing `/admin` and `/api`.

Intentionally **not** set until the owner confirms real values: canonical URL, `metadataBase`, Open Graph image, and a sitemap (all of which require a verified production domain or approved artwork).

## 9. Performance notes

- The public route is prerendered as a static shell with a bounded cache: the build output shows `○ /` with `Revalidate 1m` and `Expire 1h`. The published content is read from PostgreSQL through `use cache` + `cacheLife("minutes")` + `cacheTag("public-content")`, so a normal visit is served from cache.
- No client component, no analytics script, and no request-time database call for a cached read.
- Two font families, self-hosted and preloaded by `next/font`; no third-party font request at runtime.
- The brand logo is served through `next/image` with explicit `sizes` and preserved aspect ratio.

## 9.1 Cache and revalidation policy

Public content is cached with Next.js 16 Cache Components. `cacheLife("minutes")` bounds staleness: entries revalidate after one minute and expire after one hour, so new content cannot stay stale indefinitely. `cacheTag("public-content")` is set now so a future authenticated CMS mutation can call `revalidateTag("public-content", "max")`. No unauthenticated revalidation endpoint is exposed in Phase 3.

A cache refresh is not a fallback: if the database query fails, the page renders the documented fallback branding plus an empty directory, and stale static link data is never substituted.

## 10. How to verify

```powershell
pnpm lint
pnpm typecheck
pnpm test       # unit + local-database integration tests
pnpm build
# with the app served on http://localhost:3000
pnpm qa:visual   # screenshots + overflow/console/network checks -> .qa-screens/
pnpm qa:a11y     # structure, names, contrast, focus, zoom, reduced motion
```

`tests/integration/content-repository.test.ts` verifies the published-only filter, ordering, non-interactive `NONE`/`Segera` cards, the `#kontak` anchors, category deactivation, the `RESTRICT` delete rule, and the destination CHECK constraints against the local container.

## 11. Known limitations

- Figma comparison was unavailable (see the Phase 2 report). The implementation follows `.docs/Desain.md` and the owner's supplied screenshot description; unverified design details are recorded in the Phase 2 report and `.docs/Roadmap.md`.
- Six directory destinations and the public contact channel remain unpublished until the owner confirms them. They are now stored as `PUBLISHED` + `destinationType = NONE` (and `contact.contactEmail = null`), so unblocking them is a data change rather than a code change.
- `copyrightYear` is a constant (`2026`) because this Next.js version rejects `new Date()` during prerendering under Cache Components; it avoids per-request rendering for a footer value. Refresh it annually or move it to the CMS in Phase 5.
- There is no draft preview route: public output always shows published content only, per the approved product scope.
- Admin authentication, the CMS UI, media upload, and analytics are not implemented; they belong to Phases 4–6.
