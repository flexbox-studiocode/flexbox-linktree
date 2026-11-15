# Analytics Specification — Phase 6

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub
**Status:** Phase 6 implementation contract
**Language:** English
**Related documents:** `.docs/ANALYTICS_PRIVACY.md`, `.docs/ANALYTICS_OPERATIONS.md`, `.docs/DATABASE_SCHEMA.md`, `.docs/AGENTS.md` rules 6 and 26 of the Phase 6 brief.

## 1. Purpose and scope

Phase 6 adds privacy-conscious, first-party analytics to the public microsite and an
authenticated reporting dashboard to the CMS. This document is the single source of
truth for:

- which events are collected,
- how every reported number is defined,
- which identifier model is used,
- how time is bucketed,
- what the retention policy is,
- how the system behaves when collection fails.

Anything not defined here is out of scope. In particular, no metric in this document
claims to identify, count, or profile real people.

## 2. Event model

Only two event types exist. There is no generic event ingestion endpoint and no
client-supplied property bag.

| Event | Collected by | Trigger | Server-derived facts |
|---|---|---|---|
| `PAGE_VIEW` | `POST /api/analytics/collect` | Public page beacon after the visitor page is interactive | device, browser, OS, referrer category, campaign fields, visitor/session pseudonyms, timestamp |
| `LINK_CLICK` | `GET /go/[linkId]` | Visitor follows a tracked external card link | link identity + content snapshot loaded from PostgreSQL, device, browser, OS, referrer category, visitor/session pseudonyms, timestamp |

Both events are accepted **only** after server-side validation. A client can never
supply an event type outside this list, a link title, a destination URL, an admin
flag, or a free-form payload.

### 2.1 `PAGE_VIEW`

Accepted only when all of the following hold:

1. The request is `POST` with a `Content-Type` of `application/json` or `text/plain`
   (beacon form encoding), and the body is at most 2 KB.
2. The body validates against the strict `pageViewEventSchema` (Zod): an object with
   the literal `type: "page_view"`, an optional same-origin `path` (≤ 256 chars, must
   start with `/`), an optional `referrerUrl` (≤ 512 chars), and optional campaign
   fields.
3. The normalized path is not a CMS path (`/admin`), not an API path (`/api`), not the
   tracking redirect (`/go`), and not a static asset request.
4. The caller is not an authorized administrator (verified server-side, section 4.2).
5. The request is not classified as a bot (section 4.3).
6. The rate limit for the caller has not been exceeded (section 8.4).

Nothing about the visitor is persisted except the fields listed in section 3.

### 2.2 `LINK_CLICK`

Accepted only when the redirect resolves a link that satisfies the full public
eligibility rule (`status = PUBLISHED` AND `link.is_active` AND
`category.is_active` AND a valid `http`/`https` destination). The event is recorded
**before** the redirect is issued and never blocks it (section 9).

## 3. Stored fields

`analytics_events` stores exactly these columns. There is no `user_agent` column, no
`ip` column, and no free-form metadata column.

| Column | Content | Notes |
|---|---|---|
| `id` | UUID | Surrogate key |
| `event_type` | enum | `PAGE_VIEW`, `LINK_CLICK` |
| `occurred_at` | timestamptz | Server clock at acceptance; the only event time used for reporting |
| `received_at` | timestamptz | Database clock at insert |
| `visitor_key_hash` | 64-char hex, nullable | SHA-256(HMAC key, random first-party visitor id) |
| `session_key_hash` | 64-char hex, nullable | SHA-256(HMAC key, random first-party session id) |
| `dedupe_key` | 64-char hex, nullable, unique | Window+identity hash, see section 5.4 |
| `link_id` | uuid, nullable | Plain column, **no foreign key**, so history survives link deletion |
| `link_slug_snapshot` | text, nullable | Link slug at click time |
| `link_title_snapshot` | text, nullable | Link title at click time |
| `link_category_snapshot` | text, nullable | Owning category name at click time |
| `device_type` | enum | `DESKTOP`, `MOBILE`, `TABLET`, `OTHER`, `UNKNOWN` |
| `browser_family` | enum | `CHROME`, `SAFARI`, `FIREFOX`, `EDGE`, `OTHER`, `UNKNOWN` |
| `os_family` | enum | `WINDOWS`, `MACOS`, `LINUX`, `ANDROID`, `IOS`, `OTHER`, `UNKNOWN` |
| `referrer_category` | enum | `DIRECT`, `SEARCH`, `SOCIAL`, `REFERRAL`, `CAMPAIGN`, `INTERNAL`, `UNKNOWN` |
| `campaign_source`, `campaign_medium`, `campaign_name` | text, nullable | Sanitized, ≤ 64 chars, `[A-Za-z0-9._~-]` only |
| `created_at` | timestamptz | Row creation (database clock) |

### 3.1 Derived tables

Two rollup tables are maintained incrementally at collection time. They are the
dashboard's fast path and the retention-safe history.

**`analytics_daily_metrics`** — one row per (day, event type, dimension, dimension
value):

| Column | Content |
|---|---|
| `day` | `date`, the **Asia/Jakarta** calendar day |
| `event_type` | `PAGE_VIEW`, `LINK_CLICK` |
| `dimension` | `TOTAL`, `DEVICE`, `BROWSER`, `OS`, `REFERRER` |
| `dimension_value` | `ALL` for `TOTAL`, otherwise the enum label |
| `count` | Non-negative integer, incremented atomically |

Unique on `(day, event_type, dimension, dimension_value)`. Worst-case growth is
~60 rows/day (~22k rows/year), so the table never needs partitioning at this volume.

**`analytics_link_metrics`** — one row per (day, link):

| Column | Content |
|---|---|
| `day` | `date`, Asia/Jakarta calendar day |
| `link_id` | uuid of the clicked link (no foreign key) |
| `link_slug_snapshot`, `link_title_snapshot`, `link_category_snapshot` | historical identity copied from the link at click time |
| `clicks` | Non-negative integer, incremented atomically |

Unique on `(day, link_id)`. Rows survive link deletion, so "popular links" reports
keep historical accuracy.

No `analytics_session` table exists. Session metrics are computed with
`COUNT(DISTINCT session_key_hash)` over raw events, which is bounded by the raw
retention window (90 days). A dedicated session table would duplicate the identifier
hash without improving the metric, so it is deliberately omitted.

## 4. Identifiers

### 4.1 Visitor and session pseudonyms

- The collector issues two independent, cryptographically random 128-bit values:
  a **visitor id** and a **session id**.
- Both are delivered as first-party `HttpOnly` cookies with
  `SameSite=Lax`, `Path=/`, `Secure` in production, so page scripts cannot read them
  and cross-site requests do not carry them.
- The raw values exist only in the visitor's cookie jar. Storage holds
  `SHA-256(HMAC-SHA256(key, raw))` — a keyed digest, never the raw value.
- Rotating the HMAC key (`ANALYTICS_HASH_SECRET`) intentionally breaks all
  cross-period joins: that is a supported privacy control, not an incident.
- A missing identifier yields `NULL` for that dimension. The event is still counted
  as a page view or click; it simply cannot contribute to a distinct count.

| Identifier | Lifetime | Rotated when |
|---|---|---|
| Visitor id | 180 days | Cookie expiry, key rotation, or user clearing cookies |
| Session id | 30 minutes of inactivity | Any gap longer than the inactivity window |

### 4.2 Administrator exclusion

The collector re-reads the request's Auth.js session, verifies the JWT, and calls
`resolveAuthorizedAdmin()`, which re-checks the administrator row, `status`,
`role`, and `authVersion`. Only if that check *fails* is the event accepted. There is
no client-supplied "is admin" flag, and an unsigned or expired session is not treated
as an administrator.

### 4.3 Bot filtering

Anonymous traffic is filtered by a documented, deliberately conservative heuristic:
the normalized `User-Agent` is matched against a maintained list of well-known
crawler, monitoring, and preview signatures (`bot`, `crawler`, `spider`, `slurp`,
`bingpreview`, `facebookexternalhit`, `headlesschrome`, `lighthouse`, `pingdom`,
`uptimerobot`, `curl`, `wget`, `python-requests`, `go-http-client`, `axios`, ...).
Filtered requests are accepted with HTTP 204 and are **not** stored.

Limitations are explicit: a bot that presents a plausible browser `User-Agent` is
counted; a legitimate visitor with an unusual client string may be filtered. Filtering
never blocks a page or a redirect, so the failure mode is a small metric error, not a
broken product.

### 4.4 Retained single value

Exact request time is retained. No IP address, even a truncated or hashed one, is ever
written to analytics storage. The client address is used only in memory for the
rate-limit bucket (section 8.4) and is discarded with the request.

## 5. Metric definitions

All figures below are computed from `analytics_events` (totals and distinct counts) and
`analytics_daily_metrics` / `analytics_link_metrics` (distributions, trends, ranking).
The definitions are chosen so the two sources reconcile exactly (section 7).

### 5.1 Page views

`COUNT(*)` of accepted `PAGE_VIEW` events whose `occurred_at` falls inside the selected
period. Deduplicated per refresh window (section 5.4).

### 5.2 Sessions

`COUNT(DISTINCT session_key_hash)` of accepted events inside the period, ignoring rows
where `session_key_hash IS NULL`. A session is a bounded browser-side pseudonym, not a
person. A visitor who clears cookies or exceeds the inactivity window creates a new
session.

### 5.3 Unique visitors (estimate)

`COUNT(DISTINCT visitor_key_hash)` inside the period, ignoring `NULL`.

**This is an estimate of distinct browsers/devices, not of people.** One person on
three devices counts three times; a shared device counts once. The dashboard labels the
card accordingly.

### 5.4 Deduplication window

`dedupe_key = SHA-256(HMAC(key, "<eventType>:<identityHash>:<target>:<windowBucket>"))`,
where `windowBucket = floor(epochSeconds / 30)` and `target` is the normalized page path
for page views or the link id for clicks.

The column is `UNIQUE`. A duplicate submission inside the same 30-second bucket raises a
unique-constraint violation, which the collector treats as "already counted" and
discards silently. Behaviour:

- **Refresh**: one page view per page per 30 seconds per session. A visitor mashing
  refresh cannot inflate the metric.
- **Multi-tab**: same session and same page inside 30 seconds counts once.
- **Returning**: after 30 seconds, or after moving to a different page, a new event is
  recorded normally.
- **Click uniqueness**: `LINK_CLICK` dedupe keys additionally include the Jakarta day,
  so `COUNT(DISTINCT dedupe_key)` per link per day is exactly "unique clicks"
  (section 5.6) and cannot be inflated by repeated submissions.

### 5.5 Link clicks

`COUNT(*)` of accepted `LINK_CLICK` events inside the period.

### 5.6 Unique link clicks

Distinct `(link, session)` pairs inside the period, implemented as
`COUNT(DISTINCT dedupe_key)` for that link (the dedupe key embeds session, link, and
day). A session that clicks the same link on two different days counts once per day,
which is the documented definition used by the dashboard and the CSV export.

### 5.7 Clicks per page view (the documented CTR)

The dashboard does **not** report a "click-through rate" in the advertising sense,
because there is no reliable impression denominator for individual links. Instead it
reports:

```text
clicks per page view = total link clicks ÷ total page views
```

Both numbers come from the same period and the same event source. When page views are
zero the value renders as `—`, never `Infinity` or `NaN`. The label is always spelled
out; the abbreviation "CTR" is not used anywhere in the UI.

### 5.8 Bounce rate

**Not implemented.** No defensible engagement signal exists: a 30-minute inactivity
window is a session boundary, not an engagement verdict, and a visitor who opens one
link and leaves is indistinguishable from one who reads the page for ten minutes. A
fabricated or misleading engagement metric is worse than no metric, so the dashboard
omits it and this document records the omission deliberately.

### 5.9 Popular link

Links ranked by `SUM(clicks)` over the period, descending. Ties break deterministically
by `link_title_snapshot` ascending, then `link_id` ascending, so repeated renders and
exports produce an identical order.

### 5.10 Click share

`link clicks for this link ÷ total link clicks in the period`, rendered as a percentage
with one decimal. Zero total renders `0%` with the row still listed.

### 5.11 Distributions

Device, browser, OS, and referrer segments are `SUM(count)` over
`analytics_daily_metrics` for the matching `dimension`, grouped by `dimension_value`,
descending by count with an enum-order tie-break. `TOTAL` rows are excluded from every
distribution.

### 5.12 Period comparison

Optional. The comparison period is the immediately preceding window of identical
length, computed from the same timezone-aware boundaries. Percentage change is:

```text
current = 0 and previous = 0  ->  no change (renders "—")
previous = 0 and current > 0  ->  renders "baru" (new), never Infinity
otherwise                      ->  (current - previous) / previous, one decimal
```

## 6. Time handling and granularity

- Reporting timezone: **Asia/Jakarta**. It is a parameter of the query service, not a
  constant baked into SQL, so a future tenant or report can pass a different zone.
- A reporting day starts at Jakarta 00:00:00.000 and ends at Jakarta 23:59:59.999
  inclusive. Boundaries are converted to UTC instants before they reach PostgreSQL.
- Day keys are stored as `date` values produced by the same conversion, so a daily row
  and the raw events that produced it always agree.
- Asia/Jakarta has had a fixed UTC+07:00 offset since 1964 and observes no daylight
  saving, but offsets are still computed through `Intl.DateTimeFormat` rather than
  hardcoded, so the code stays correct if the tz database changes.
- Granularity options: hourly (raw events only, 48-hour maximum), daily, weekly
  (ISO weeks starting Monday), monthly. Weekly and monthly buckets are derived from
  daily rows, so they remain available after raw events expire.
- Charts and tables display Jakarta local dates. Timestamps in the event detail are
  shown in Jakarta time with the `WIB` label.

## 7. Reconciliation rule

For any period fully inside raw retention:

```text
SUM(analytics_daily_metrics.count  WHERE dimension = 'TOTAL' AND event_type = E)
  = COUNT(analytics_events WHERE event_type = E AND occurred_at in period)
```

and

```text
SUM(analytics_link_metrics.clicks for the period)
  = COUNT(analytics_events WHERE event_type = 'LINK_CLICK' AND occurred_at in period)
```

Both identities are asserted by integration tests. A mismatch means the rollup write
failed for some events and is a defect.

## 8. Data quality and known limitations

### 8.1 Bot filtering

Heuristic and imperfect (section 4.3). Reported numbers are "human-ish browser
traffic", not a certified human count. No bot-detection vendor is used, so no
third-party request is made from the visitor's browser.

### 8.2 Ad blockers and privacy extensions

The collector is same-origin and first-party, which reduces but does not eliminate
blocking. A blocked beacon is an uncounted page view, never a page error. A visitor who
blocks the request still receives the full page and every link works.

### 8.3 Duplicate events

Handled by the unique `dedupe_key` (section 5.4). Duplicate inserts are discarded at
the database level, so a retry cannot double count.

### 8.4 Delivery failures

If event insertion or rollup fails, the collector logs the error name only and returns
HTTP 204. The visitor's page and the link redirect are unaffected. There is no retry
queue in Phase 6: an event that fails to insert is lost, and the loss is bounded by the
failure duration. Section 9 defines the redirect trade-off.

### 8.5 Session identity

Cookie-based, therefore approximate (section 5.2). Private windows, cookie clearing,
multiple devices, and Safari's storage policies all create additional sessions.

### 8.6 Aggregation timing

Rollups are written inside the same request as the event, in the same transaction.
Consequently the dashboard reflects accepted events immediately; there is no batch lag
to explain or wait for.

### 8.7 Referrer attribution

Referrer classification uses the host of the referring URL supplied by the browser, or
the campaign fields parsed from the current URL. Cross-origin referrers are frequently
stripped by browser privacy policy, so `DIRECT` is inflated relative to reality. Full
referrer URLs, paths, and query strings are never stored.

### 8.8 Low-volume distortion

A small site produces small numbers. A single crawler that evades the filter, or one
enthusiastic visitor, can visibly move a daily figure. The dashboard never extrapolates
and never displays an estimated total as if it were measured.

## 9. Reliability model for link clicks

`GET /go/[linkId]` performs, in order:

1. Validate the id as a UUID.
2. Load the link with its category from PostgreSQL.
3. Re-check the full public eligibility rule and the destination scheme.
4. Record the click event (bounded to a 1.5-second in-process timeout).
5. Issue the `307` redirect to the resolved destination.

Steps 4 and 5 are independent: a failure or timeout in step 4 is logged and swallowed,
and step 5 still runs for a valid destination. Analytics is never allowed to delay a
valid redirect indefinitely, and never turns a working link into a broken one. The
trade-off is that an event may be lost when the database is slow or unavailable; the
dashboard surfaces a collection-availability warning in that case.

No destination is ever derived from the request. The URL always comes from the stored
link row, so `/go/[linkId]` cannot be used as an open redirect.

## 10. Retention

| Data | Default retention | Control |
|---|---|---|
| Raw events (`analytics_events`) | 90 days | `ANALYTICS_RAW_RETENTION_DAYS` |
| Daily rollups (`analytics_daily_metrics`) | 400 days | `ANALYTICS_AGGREGATE_RETENTION_DAYS` |
| Link rollups (`analytics_link_metrics`) | 400 days | `ANALYTICS_AGGREGATE_RETENTION_DAYS` |
| Rate-limit buckets | 1 day | fixed, in-memory |

Cleanup is a repeatable, bounded, idempotent CLI (`pnpm analytics:cleanup`) with a
`--dry-run` mode. It runs only when an operator or scheduler invokes it: the application
never deletes analytics data during `next dev`, on boot, or from an in-process timer.
Rollups are always retained longer than raw events, so the long-range trend chart stays
populated after raw events expire. See `.docs/ANALYTICS_OPERATIONS.md`.

## 11. Consent model

The collector stores only a random first-party pseudonym and coarse, non-identifying
categories, makes no request to a third party, and never stores an IP address, so the
initial release collects without a consent gate. This is a product decision based on the
data actually stored, not a claim that pseudonymized data is legally anonymous. The full
reasoning, the cookie inventory, and the trigger conditions that would require a consent
banner are recorded in `.docs/ANALYTICS_PRIVACY.md`. If a jurisdiction requires prior
consent, the collector can be disabled globally without touching the public page by
unsetting `ANALYTICS_HASH_SECRET` — the collector then records nothing and every metric
renders as zero.
