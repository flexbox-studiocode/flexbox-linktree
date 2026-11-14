# System Architecture

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub  
**Status:** Initial architecture baseline  
**Language:** English

## 1. Architecture Summary

Flexbox Linktree is a single Next.js application with two user-facing areas:

- Public microsite: editorial directory, branding, contact, and SEO metadata.
- Private CMS: authentication, content management, settings, media, and analytics.

The initial persistence layer is PostgreSQL accessed through Prisma ORM. The application is developed locally on Windows, tested against an isolated local PostgreSQL container, and deployed to a Flexbox-managed VPS through Coolify.

The architecture should remain a modular monolith for the first release. Do not split the product into microservices until measured scale, operational needs, or team ownership justify that complexity.

## 2. High-Level Context

```mermaid
flowchart TD
    Visitor[Public Visitor] --> Public[Next.js Public Pages]
    Admin[Authorized Flexbox Member] --> Login[Auth.js Authentication]
    Login --> CMS[Next.js Admin CMS]
    Public --> Services[Server-side Application Services]
    CMS --> Services
    Services --> Prisma[Prisma ORM]
    Prisma --> DB[(PostgreSQL)]
    Public --> Tracking[Analytics Event Endpoint]
    Tracking --> Services
    CMS --> Media[Media Storage Adapter]
    Media --> Storage[(Persistent or S3-compatible Storage)]
```

## 3. Deployment Topology

### 3.1 Local Development

- Windows workstation with VS Code and PowerShell.
- Next.js runs directly on the host for fast hot reload.
- PostgreSQL runs in Docker Desktop/WSL2.
- Local database is exposed only on loopback, currently `127.0.0.1:5433` on the host mapped to container port `5432`.
- `.env.local` contains local-only variables and must never be committed.

### 3.2 Staging

Staging is recommended before production. It must use:
- A separate application deployment/environment.
- A separate PostgreSQL database or isolated PostgreSQL instance.
- Separate authentication secrets and provider credentials.
- Dummy or sanitized data only.
- No connection to the production database.

If budget prevents a separate staging VPS, staging may initially run as isolated services on the same VPS, with strict resource limits and separate credentials. Do not treat a separate database name on the production database as equivalent to full infrastructure isolation.

### 3.3 Production

Initial production can run on one VPS managed by Coolify:
- Next.js application container.
- PostgreSQL container/service with persistent storage.
- Coolify reverse proxy and HTTPS.
- Persistent media volume or external object storage.
- Backup process that sends database/media backups off the VPS.

Keep PostgreSQL private to the application network. Do not expose database port `5432` to the public internet. Use SSH keys, firewall rules, and least-privilege database credentials.

## 4. Application Structure

Use Next.js App Router and organize code by route and feature/domain:

- `app/(public)`: public microsite routes and public layouts.
- `app/admin`: protected CMS routes.
- `app/api`: narrowly scoped route handlers for authentication callbacks, analytics collection/redirect, uploads, and integrations where needed.
- `features`: business logic for links, categories, settings, media, analytics, and admin access.
- `lib`: infrastructure adapters such as Prisma, Auth.js, validation, logging, and security helpers.
- `components`: reusable presentation components separated into public/admin/shared areas.

Use Server Components by default. Add Client Components only for interactive controls such as forms, tables with client-side interaction, charts, menus, and date filters.

## 5. Main Routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Public digital hub | Public |
| `/admin/login` | Admin sign-in | Public route, authentication only |
| `/admin` | Admin dashboard | Super Admin |
| `/admin/links` | Link management | Super Admin |
| `/admin/links/new` | Create link | Super Admin |
| `/admin/links/[id]` | Edit link | Super Admin |
| `/admin/categories` | Category management | Super Admin |
| `/admin/media` | Media library | Super Admin |
| `/admin/settings` | Website settings | Super Admin |
| `/admin/analytics` | Analytics overview | Super Admin |
| `/admin/analytics/links` | Link performance | Super Admin |
| `/admin/analytics/audience` | Device/browser/OS breakdown | Super Admin |
| `/admin/admins` | Admin account management | Super Admin |
| `/admin/audit-logs` | Administrative audit history | Super Admin |

Route names may be adjusted during implementation, but public/admin access boundaries must remain clear.

## 6. Domain Modules

### 6.1 Content

Owns link, category, settings, and publication rules. Public queries must return only active, published records and active categories.

### 6.2 Authentication and Authorization

Auth.js handles authentication/session integration. Application authorization checks the active allowlisted member record and the `SUPER_ADMIN` role. Every protected server action, route handler, and server-side data access must perform authorization independently.

Do not rely solely on middleware or client-side route hiding. Middleware/proxy can provide an early redirect, but it is not the only authorization boundary.

**Provider/session decision:**
- For OAuth/email providers, use a compatible Auth.js Prisma adapter and database sessions where supported.
- For Credentials provider, explicitly implement password verification and use JWT session strategy as required by Auth.js Credentials behavior. A Prisma adapter does not automatically persist Credentials users or convert Credentials sessions to database sessions.
- Confirm one path before implementing account provisioning.

### 6.3 Media

Use a storage interface so local storage and production object storage can be swapped without changing CMS business logic. Store metadata and storage keys in PostgreSQL; store binary files in persistent/object storage, not as database blobs by default.

### 6.4 Analytics

Analytics is an application module, not a separate microservice in the first release. Store normalized events in PostgreSQL and produce aggregate queries/materialized daily summaries as volume justifies.

## 7. Analytics Data Flow

```mermaid
sequenceDiagram
    participant V as Visitor Browser
    participant N as Next.js Server
    participant P as Prisma
    participant D as PostgreSQL

    V->>N: Open public page
    N->>P: Read published content
    P->>D: Query links/categories/settings
    D-->>P: Published content
    P-->>N: Content result
    N-->>V: Render page
    V->>N: Click link ID
    N->>P: Resolve published link and record click event
    P->>D: Insert normalized analytics event
    N-->>V: Redirect to stored destination URL
```

The click endpoint must resolve the target by a valid published link ID. It must not accept an arbitrary destination URL from the browser, which would create an open-redirect vulnerability. Analytics persistence should be best-effort: if event recording fails, navigation should still succeed.

## 8. Analytics Data Design

Initial entities may include:
- `AnalyticsEvent`: immutable event occurrence, event type, UTC timestamp, optional link ID, session identifier hash/reference, and normalized dimensions.
- `AnalyticsDailyAggregate`: date, metric/dimension keys, counts, and aggregation version.
- `AnalyticsSession`: optional coarse session record if required for session and returning-visitor estimates.

Do not store raw IP addresses or detailed device fingerprints. Store normalized device/browser/OS families. Sanitize referrer data and avoid query strings that may contain identifiers. Exclude admin traffic and known bots where practical.

Use indexes for common filters: `occurredAt`, `eventType`, `linkId`, and selected dimension/date combinations. Do not prematurely partition tables or introduce a data warehouse.

Default reporting timezone: `Asia/Jakarta`. Store all event timestamps in UTC; convert only for report boundaries and display.

Initial raw-event retention target: 90 days, subject to privacy review. Aggregated daily metrics may be kept longer.

## 9. Data Model Domains

The schema should be designed around these domains:

| Domain | Suggested entities |
|---|---|
| Identity | Auth.js User/Account/Session tables if adapter strategy is selected; AdminMembership or admin profile; AdminInvitation |
| Content | Link, Category, SiteSetting |
| Media | MediaAsset |
| Analytics | AnalyticsEvent, AnalyticsDailyAggregate, optional AnalyticsSession |
| Operations | AuditLog |

Use UUID identifiers, unique slugs, foreign keys, explicit status fields, timestamps, and indexes. Define deletion behavior deliberately. Avoid cascading deletion of historical analytics when a link is deleted; preserve a snapshot or nullable reference as appropriate.

## 10. Security Architecture

- No public registration.
- Only allowlisted, active Flexbox members with `SUPER_ADMIN` role can access the CMS.
- Verify authorization on every server-side mutation and protected data query.
- Use secure session cookies and HTTPS in production.
- Keep OAuth credentials, `AUTH_SECRET`, and database credentials out of Git.
- Hash passwords with a modern password-hashing algorithm if Credentials login is selected.
- Rate-limit login, invitation, password-reset, and analytics endpoints.
- Validate inputs using Zod (or an approved equivalent) on the server.
- Restrict URL protocols and redirect destinations.
- Validate uploaded files by size and actual MIME/content type.
- Keep database networking private.
- Use least-privilege database users and separate credentials per environment.
- Record relevant admin actions without logging secrets.

## 11. Environment and Configuration

Use distinct values for:
- Local development.
- Automated tests.
- Staging.
- Production.

Never share a database URL, Auth.js secret, OAuth secret, or storage credential across environments. `.env.local` is for local Next.js development. Docker Compose automatically reads `.env` by default, not `.env.local`; keep local Compose credentials explicit or place Compose-only variables in a separate ignored `.env` file. Ensure the host port and database URL match.

## 12. Database Migration and Release

- Create schema changes using reviewed Prisma migrations in development.
- Commit migration files to Git.
- Run `prisma migrate deploy` during controlled staging/production release.
- Never run `prisma migrate dev` against production.
- Take a verified backup before risky production schema changes.
- Use a tested rollback/forward-fix plan; database rollback is not assumed to be automatic.

## 13. Observability and Backup

- Application health endpoint or equivalent health check.
- Container health checks.
- Structured logs with secrets and personal data redacted.
- Resource monitoring for CPU, RAM, disk, and database storage.
- Automated database backups stored outside the VPS.
- Media backup or object-storage durability strategy.
- Periodic restore tests.

Persistent Docker volumes protect against container replacement, not VPS loss. A backup stored only on the production VPS is not an independent backup.

## 14. Design Document Relationship

`.docs/Desain.md` remains the primary visual design guide for the public microsite. This architecture and the approved PRD extend the product scope to include the private CMS, authentication, PostgreSQL, and analytics. Where the earlier design document says that admin, login, database, or CMS are not product goals, the newer approved product requirements supersede that scope statement. Its visual rules, public-page hierarchy, typography, color, responsiveness, and accessibility guidance remain applicable unless explicitly revised.
