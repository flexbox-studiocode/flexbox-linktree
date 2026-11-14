# Public User Page — Phase 2

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub  
**Status:** Implemented (Phase 2)  
**Language:** English

## 1. Scope

Phase 2 implements the public microsite only. The private Admin CMS, authentication, database-backed content, analytics collection, and deployment belong to later roadmap phases (see `.docs/Roadmap.md`).

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

Content lives outside the presentation components:

- `src/features/public/content.ts` — `LinkCategory`, `LinkItem`, `siteContent`, `publicAnchors`.
- `src/features/public/contact.ts` — the contact destination switch.
- `src/features/public/copyright.ts` — the stable copyright year.

```ts
export type LinkItem = {
  id: string;
  title: string;
  description: string;
  category: string;          // owning category slug
  icon: LinkIconName;
  href?: string;             // omitted until the owner confirms the destination
  tag?: string;
  isFeatured?: boolean;
  sortOrder: number;
};

export type LinkCategory = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  links: LinkItem[];
};
```

Categories and links are sorted by `sortOrder` at render time, so the CMS phase can reorder records without touching components. Presentation components receive `LinkItem` props only, which keeps a later database-backed replacement mechanical.

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
| Flexbox Design System | No URL confirmed |
| Flexbox Lab | No URL confirmed |
| Website Flexbox | No URL confirmed |
| Sumber Daya | No URL confirmed |
| Karya Digital | No URL confirmed |
| Eksperimen Visual | No URL confirmed |

No email address, social handle, or external contact URL is published. `contactEmail` in `src/features/public/contact.ts` is `null`; while it is `null`, the contact section shows the status label "Kanal kontak segera dipublikasikan" instead of a fake `mailto:` link. Setting it to a verified address switches the section to a real contact button with no other code change.

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

- The public page is fully static (`○ /` in the build output). No database call, no client component, no analytics script.
- Two font families, self-hosted and preloaded by `next/font`; no third-party font request at runtime.
- The brand logo is served through `next/image` with explicit `sizes` and preserved aspect ratio.

## 10. How to verify

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# with the dev server running on http://localhost:3000
pnpm qa:visual   # screenshots + overflow/console/network checks -> .qa-screens/
pnpm qa:a11y     # structure, names, contrast, focus, zoom, reduced motion
```

## 11. Known limitations

- Figma comparison was unavailable (see the Phase 2 report). The implementation follows `.docs/Desain.md` and the owner's supplied screenshot description; unverified design details are recorded in the Phase 2 report and `.docs/Roadmap.md`.
- Six directory destinations and the public contact channel remain unpublished until the owner confirms them.
- `copyrightYear` is a constant (`2026`) because this Next.js version rejects `new Date()` during prerendering under Cache Components; it avoids per-request rendering for a footer value. Refresh it annually or move it to the CMS in Phase 5.
