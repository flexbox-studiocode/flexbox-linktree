# Analytics Privacy Model — Phase 6

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub
**Status:** Approved for the Phase 6 implementation
**Language:** English
**Companion documents:** `.docs/ANALYTICS_SPECIFICATION.md` (metric contract), `.docs/ANALYTICS_OPERATIONS.md` (retention and maintenance), `.docs/AUTH_SECURITY.md`.

## 1. Summary of the decision

The public microsite collects two first-party events (`PAGE_VIEW`, `LINK_CLICK`) and stores
only coarse, non-identifying categories plus keyed pseudonyms. It makes no third-party
request from the visitor's browser, stores no IP address, no `User-Agent` string, no
referrer URL, and no free-form payload.

Because nothing personally identifying is stored, the initial release collects without a
consent banner. This is a product decision about the data actually written, not a claim
that pseudonymised data is legally anonymous. Section 8 lists the conditions that would
force a consent gate.

## 2. Data inventory

### 2.1 Stored

| Data | Granularity | Purpose |
|---|---|---|
| Event type | `PAGE_VIEW` or `LINK_CLICK` | Counting |
| Occurred/received timestamp | Second precision, UTC | Time bucketing |
| Jakarta calendar day | Date | Day grouping, dedupe uniqueness |
| Visitor pseudonym | 64-character keyed digest | Distinct-browser estimate |
| Session pseudonym | 64-character keyed digest | Distinct-session count |
| Dedupe digest | 64-character keyed digest | Idempotency |
| Device type | `DESKTOP`, `MOBILE`, `TABLET`, `OTHER`, `UNKNOWN` | Distribution |
| Browser family | `CHROME`, `SAFARI`, `FIREFOX`, `EDGE`, `OTHER`, `UNKNOWN` | Distribution |
| Operating system family | `WINDOWS`, `MACOS`, `LINUX`, `ANDROID`, `IOS`, `OTHER`, `UNKNOWN` | Distribution |
| Referrer category | `DIRECT`, `SEARCH`, `SOCIAL`, `REFERRAL`, `CAMPAIGN`, `INTERNAL`, `UNKNOWN` | Distribution |
| Campaign source/medium/name | Optional, machine-shaped, ≤ 64 characters | Attribution |
| Link identity on a click | Link id, slug, title, category name at click time | Historical ranking |

### 2.2 Never stored

- IP address, in any form (raw, truncated, or hashed).
- `User-Agent` string, accept-language, or any other raw request header.
- Full referrer URL, path, query string, or fragment.
- Cookies other than the two first-party analytics cookies.
- Email addresses, names, account identifiers, or Auth.js session tokens.
- Free-form event properties, page coordinates, scroll depth, or keystrokes.
- Any value supplied by the browser that is not validated by the strict event schema.

### 2.3 Not measured, deliberately

- Bounce rate. There is no defensible engagement signal (see the specification, section 5.8).
- Per-link impression counts. The microsite has no reliable impression denominator, so the
  dashboard reports "clicks per page view" instead of an advertising click-through rate.
- Cross-device or cross-site identity. No identifier is shared with another site.
- Demographic, geographic, or interest inference.

## 3. Identifier model

Two independent random 128-bit values are minted by the server:

- **Visitor id** — stable for 180 days, used only to estimate distinct browsers.
- **Session id** — expires after 30 minutes of inactivity, used only to count sessions.

Both are delivered as `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production
cookies, so page scripts cannot read them and cross-site requests do not carry them. The
cookie names are `fb_analytics_visitor` and `fb_analytics_session`.

Only `SHA-256(HMAC-SHA256(ANALYTICS_HASH_SECRET, "<purpose>:<raw value>"))` is written to
PostgreSQL. The raw value never leaves the visitor's cookie jar, and the HMAC key is a
dedicated secret that is not shared with Auth.js session signing.

Consequences that are accepted and documented:

- Clearing cookies creates a new visitor and a new session.
- Rotating `ANALYTICS_HASH_SECRET` makes every previously stored digest unlinkable from
  future traffic. Distinct counts restart. This is a supported privacy control.
- Without the key (production and no value configured), collection is disabled entirely.
  There is no unkeyed fallback, because an unkeyed hash of a short identifier is
  brute-forceable.

## 4. Cookie inventory

| Name | Purpose | Lifetime | Attributes |
|---|---|---|---|
| `fb_analytics_visitor` | Distinct-browser estimate | 180 days | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production |
| `fb_analytics_session` | Session boundary | 30 minutes of inactivity, re-issued on each accepted event | Same |
| `__Secure-next-auth.session-token` (administrators only) | Auth.js session | Existing Phase 4 policy | Unchanged by Phase 6 |

No cookie is written by the public page itself. Cookies are set only on the response to an
accepted event, and only by the server. A visitor who blocks the collector receives no
analytics cookie and loses no functionality.

## 5. Administrator exclusion

The collector re-reads the Auth.js session on the server, verifies the JWT, and re-derives
authorization from the administrator row. If the caller is an authorised administrator, the
event is discarded. There is no client-supplied admin flag, and an expired or forged token
is not treated as an administrator.

## 6. Third parties

There are none. The collector is same-origin (`/api/analytics/collect`), the redirect is
same-origin (`/go/<linkId>`), and the dashboard reads only the application database. No
analytics vendor, tag manager, font CDN, or pixel is contacted by the public page.

## 7. Access control, export, and retention

- Reporting is available only to an authenticated, active, allowlisted `SUPER_ADMIN`, checked
  server-side on every page, route handler, and report query.
- CSV export is authorised with `requireAdminAction()` and contains aggregate rows only. It
  never contains an event id, pseudonym, or raw request value, and every cell is neutralised
  against spreadsheet formula injection.
- Raw events are retained for 90 days, rollups for 400 days, both configurable. The cleanup
  command is documented in `.docs/ANALYTICS_OPERATIONS.md`; the application never deletes
  analytics data on its own.
- There is no public analytics endpoint and no per-visitor drill-down view.

## 8. Consent decision and trigger conditions

Collection without a consent gate is acceptable **only** while all of the following hold:

1. No IP address, raw header, or referrer URL is stored.
2. Identifiers are random, first-party, and stored only as keyed digests.
3. No data is shared with a third party.
4. Reporting is aggregate and available only to the site operator.
5. Retention is bounded and enforced.

A consent gate becomes mandatory before any of the following is introduced:

- Storing an IP address or a raw `User-Agent` for debugging.
- Joining analytics data to a named account, order, or form submission.
- Adding a third-party analytics, advertising, or session-recording script.
- Cross-site tracking, fingerprinting, or identity resolution.
- Reporting that names or singles out an individual visitor.

If a jurisdiction requires prior consent, the collector can be disabled globally without
touching the public page by unsetting `ANALYTICS_HASH_SECRET`. Every metric then renders as
zero and the dashboard shows the disabled state.

## 9. Threat model

| Risk | Control |
|---|---|
| Database disclosure reveals a person | Only keyed digests and coarse categories are stored; the HMAC key lives in the environment, not the database |
| Identifier replay from another site | Cookies are `SameSite=Lax`, first-party, and contain no value the browser derives from elsewhere |
| Beacon used to poison metrics | Strict schema, 2 KB body cap, per-caller rate limit, bot filter, 30-second dedupe window |
| Collector used to probe the CMS | Every request answers `204`, including rejections; no error detail is returned |
| Redirect abused as an open redirect | Destination is always read from PostgreSQL and rechecked for publication, activation, and `http(s)` scheme |
| Analytics compromises availability | Collection is best-effort; page render and redirect never depend on a successful event write |
| Spreadsheet formula execution from a link title | Export cells beginning with `=`, `+`, `-`, `@`, tab, or CR are prefixed with an apostrophe |

## 10. Change control

Any change to a stored column, a cookie, a retention horizon, or a third-party integration
requires an update to this document and to `.docs/ANALYTICS_SPECIFICATION.md` in the same
change. The privacy review trigger list in section 8 is the gate: if a change matches one of
those conditions, the consent decision must be revisited first.