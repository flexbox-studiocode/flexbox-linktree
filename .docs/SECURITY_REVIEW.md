# Security Review — Phase 7

Scope: the application as committed after Milestone D. Evidence in this
document comes from executed checks, not from reading code alone. Commands and
observed output are recorded verbatim where they matter.

## 1. Trust boundaries

| Boundary | Control |
|---|---|
| Public visitor → public page | Read-only; only `PUBLISHED` + active records under active categories reach the query. No admin data in the public payload. |
| Public visitor → `/api/analytics/collect` | Unauthenticated by design; strict schema, bounded body, same-origin check, rate limit, always 204. |
| Public visitor → `/go/[linkId]` | Destination resolved server-side from a published link ID; never a client-supplied URL. |
| Browser → CMS | Auth.js JWT session **and** server-side `requireAdmin` / `requireSuperAdmin` on every page, Server Action, and data service. |
| CMS → database | Prisma with the `pg` adapter; credentials only in server environment. |
| Operator → provisioning CLIs | Local operator access only; no network registration path. |

`src/proxy.ts` remains an optimistic redirect gate. It is not the authorization
boundary; a request that reaches a page or action without an allowlisted
`SUPER_ADMIN` is rejected inside the server code.

## 2. Hardening applied in this milestone

### 2.1 HTTP security headers (`next.config.ts`)

All responses now carry:

- `Content-Security-Policy` — `default-src 'self'`, `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `connect-src 'self'`, restricted `img`/`font`/`media` sources.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (effective
  only over TLS)

Private surfaces additionally receive:

- `/admin/:path*` → `Cache-Control: private, no-store, max-age=0`,
  `X-Robots-Tag: noindex, nofollow`
- `/api/auth/:path*` → `Cache-Control: private, no-store, max-age=0`,
  `X-Robots-Tag: noindex, nofollow`

Observed on the production server (`PORT=3100`):

```text
GET /admin/login
Cache-Control: private, no-store, max-age=0
X-Robots-Tag: noindex, nofollow
Content-Security-Policy: default-src 'self'; ... frame-ancestors 'none'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

### 2.2 Collector request shape (`src/features/analytics/services/collector-request.ts`)

- **Bounded body read.** The route no longer calls `request.text()` (which reads
  an unbounded body). `readCollectorBody()` rejects a declared
  `Content-Length > 2048`, reads the stream incrementally, and cancels the
  reader as soon as the accumulated byte count exceeds `MAX_EVENT_BODY_BYTES`.
- **Same-origin check.** `isSameOriginCollectorRequest()` compares `Origin`
  against `NEXTAUTH_URL` (falling back to the request URL origin) and uses
  `Sec-Fetch-Site: same-origin` when `Origin` is absent. When no browser signal
  exists at all, the request proceeds to strict schema validation; the collector
  writes analytics only and cannot mutate content or sessions.

Verified: cross-site request returns 204 and is discarded.

```text
POST /api/analytics/collect
Origin: https://evil.example
Content-Type: application/json
→ 204
```

### 2.3 Credential timing (`authenticate-admin.ts`, `password.ts`)

Previously an unknown email skipped Argon2 entirely, so response latency
revealed account existence. Now every attempt performs exactly one Argon2id
verification against either the stored hash or `DUMMY_PASSWORD_HASH` (a
precomputed hash of an unrelated sentinel, not a real credential). The
`valid` decision still requires `status = ACTIVE`, `role = SUPER_ADMIN`, and a
successful password match.

### 2.4 Cache invalidation (`admin-content.ts`)

`setLinkFeatured()` persisted `isFeatured` but never invalidated the public
cache, so a featured toggle could stay invisible for the `cacheLife` window.
It now calls `invalidatePublicContent()` (`updateTag("public-content")` +
`revalidatePath("/")`), matching every other content mutation.

## 3. Verification performed

| Check | Result |
|---|---|
| `pnpm lint` | No findings. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | 28 files / 303 tests passed, including new collector-request and featured-invalidation tests. |
| `pnpm build` | Passed. |
| Production header probe | CSP, nosniff, frame deny, referrer, permissions, COOP/CORP, HSTS present on `/` and `/admin/login`. |
| Private cache probe | `/admin/login` returns `private, no-store` and `noindex`. |
| Cross-site collector probe | 204, not recorded. |

## 4. Controls re-verified by source review

- Sign-in throttling is per-account plus per-source bucket (when proxy headers
  are trusted) and only buckets are persisted (HMAC, never raw addresses).
- `authVersion` revocation still gates every session read.
- Password hashes are Argon2id `m=19456,t=2,p=1`, 32-byte output, unique salts.
- Media uploads validate magic bytes, reject SVG, cap size, and are served
  through the storage abstraction.
- Analytics never persists raw IPs; device/browser/OS/referrer are normalized.
- CSV export neutralizes spreadsheet formula injection.
- MySQL-style unprepared SQL is not used; Prisma parameterizes queries.
- No secret is read into a Client Component or a public `NEXT_PUBLIC_` variable.

## 5. Residual risks and documented limitations

These are accepted for Phase 7 and must be addressed or explicitly accepted
before production exposure.

1. **CSP allows inline script/style.** The App Router emits inline bootstrap and
   flight data, and the approved visual design uses inline critical styles. A
   nonce-based CSP requires per-request HTML and conflicts with the current
   static/cached rendering. Tightening is a Phase 8 task.
2. **No MFA.** The CMS protects a high-value account with a single password plus
   throttling. MFA remains roadmap work.
3. **Production mail transport is not operable.** `getAdminMailer()` supports
   only the development file transport; production password recovery and
   invitations require a real provider configured before launch.
4. **HSTS depends on TLS termination.** The header is inert over plain HTTP and
   assumes the production proxy serves HTTPS.
5. **Collector origin check has a compatibility fallback.** Requests with neither
   `Origin` nor `Sec-Fetch-Site` are accepted to avoid silently dropping page
   views from privacy-stripping clients. Abuse is still bounded by schema,
   body size, rate limit, and the absence of side effects.
6. **Throttling depends on the database.** Both buckets are read and written in
   PostgreSQL. If the throttle query fails, `authenticateAdmin` rejects by
   throwing, so sign-in is unavailable rather than unthrottled — fail-closed, at
   the cost of an operator-visible error during a database outage. Recovery and
   invitation endpoints behave the same way.

## 6. Review statement

The application and access boundaries were reviewed end to end: public
rendering, redirect handling, collector, CMS authorization, provisioning,
recovery, media, storage, and analytics. The four defects found in this phase
(collector body read, cross-site collector body, unknown-account timing, missing
featured invalidation) are fixed and covered by tests. No unresolved
high-severity finding remains in the reviewed code. The limitations in §5 are
operational or deferred-hardening items, not vulnerabilities in the shipped
logic.