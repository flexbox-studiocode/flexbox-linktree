# Product Requirements Document (PRD)

**Product:** Flexbox Linktree / Flexbox Studio Digital Hub  
**Document status:** Initial specification  
**Language:** English  
**Product owner:** Flexbox Studio  
**Primary platform:** Web  

## 1. Product Overview

Flexbox Linktree is a centrally managed digital hub for Flexbox Studio. It provides a public, editorial-style directory of the studio's projects, websites, portfolio, resources, community destinations, and contact channels. It also provides a private Content Management System (CMS) that authorized Flexbox members can use to manage public content and review privacy-conscious analytics.

The product has two distinct experiences that share one content system:

1. **Public User Page:** a lightweight, responsive microsite focused on clear branding and curated link cards.
2. **Private Admin Page:** a protected CMS for content management, website configuration, media management, and analytics.

The public experience must remain a microsite, not an application dashboard. The admin experience may use conventional dashboard patterns such as a sidebar, tables, forms, and charts.

## 2. Product Goals

- Present Flexbox Studio's digital ecosystem in one recognizable destination.
- Let visitors understand the studio and reach relevant destinations quickly.
- Allow authorized Flexbox members to manage public content without editing source code.
- Provide reliable publishing controls for links, categories, branding, contact details, and metadata.
- Provide advanced, privacy-conscious analytics for page views, link clicks, trends, devices, browsers, operating systems, and popular links.
- Support local development and testing before deployment to Flexbox-owned VPS infrastructure.
- Keep the architecture maintainable and suitable for future Flexbox projects without overengineering the first release.

## 3. Non-Goals

The following are outside the initial scope unless explicitly approved later:

- A public account-registration system.
- A multi-tenant, customer-facing Linktree SaaS product.
- Visitor profiles, visitor login, comments, or social networking.
- A public search/filter experience in the directory.
- A page builder that lets administrators change arbitrary layouts, CSS, or application code.
- E-commerce, payments, subscriptions, or pricing plans.
- Real-time visitor surveillance, device fingerprinting, or persistent raw-IP tracking.
- A complex multi-role permission matrix in the first release. The initial admin role is Super Admin only.

## 4. Users and Roles

### 4.1 Public Visitor

A visitor can:
- Open the public microsite.
- Read the studio introduction and curated directory.
- Open published links.
- Use the contact and social destinations that have been verified by Flexbox.
- Use the website on mobile, tablet, and desktop.

A visitor cannot:
- Access admin routes or private CMS data.
- Create an account.
- View drafts, archived links, internal analytics, or audit logs.

### 4.2 Flexbox Super Admin

A Super Admin is an explicitly authorized Flexbox member. A Super Admin can:
- Sign in through the configured authentication provider.
- Manage links and categories.
- Manage media assets.
- Manage public website content and settings.
- Publish, unpublish, archive, reorder, and feature links.
- View analytics and export permitted reports.
- Invite, activate, deactivate, or revoke access for other approved Flexbox members, subject to the approved account-provisioning workflow.
- Review administrative audit logs.

There is no public registration. Knowing the admin URL or having a valid external identity is not sufficient for access; the account must be allowlisted and active.

### 4.3 Role Model

The first release uses one application role: `SUPER_ADMIN`. The data model may remain extensible for future roles, but Editor/Admin role interfaces and granular permissions are not part of the initial release.

## 5. Public User Page Requirements

### 5.1 Header and Navigation

- Display the approved Flexbox logo and studio name.
- Provide a link to the directory section.
- Provide a contact call-to-action.
- Support a compact mobile layout.
- Sticky behavior is optional and must not obscure content or keyboard focus.

### 5.2 Hero Section

- Display an editable headline, subtitle, and internal directory call-to-action.
- Use the existing screenshot's visual direction as the starting reference.
- Allow authorized administrators to edit text and approved logo/brand assets through the CMS.
- Keep the hero compact so the directory remains easy to reach.

### 5.3 Editorial Link Directory

- Render published categories and published links only.
- Do not display search, filter chips, pagination, or a results counter in the initial editorial experience.
- Allow a maximum of two columns when the viewport has sufficient width.
- Prefer one column on narrow mobile screens; verify at 320px and approximately 390px.
- Preserve category grouping and administrator-defined order.
- Do not render empty categories unless the public design explicitly calls for them.

### 5.4 Link Card

A link card may contain:
- Title (required).
- Short description (optional but recommended).
- Destination URL (required).
- Category (required unless a future exception is approved).
- Icon or thumbnail (optional).
- Small tag/label (optional).
- Featured state (optional).

Behavior:
- The full card is a semantic anchor.
- External destinations open safely using appropriate `rel` attributes when opening a new tab.
- A click is recorded through the analytics tracking flow without noticeably delaying navigation.
- Only published, active links are available publicly.

### 5.5 Contact CTA and Footer

- Editable contact message and verified contact destination.
- Optional verified social links.
- Editable footer description and navigation destinations.
- Dynamic copyright year unless an explicit fixed year is required.

### 5.6 SEO and Sharing Metadata

- Editable page title and meta description.
- Configurable canonical URL.
- Open Graph title, description, and image.
- Favicon and site identity assets.
- Sensible robots metadata and sitemap/robots handling where applicable.

## 6. Admin CMS Requirements

### 6.1 Authentication and Access Control

- Admin routes are private by default.
- No public sign-up route.
- Only active, allowlisted Flexbox members with `SUPER_ADMIN` role may access CMS data and mutations.
- Authorization must be enforced server-side for every protected operation; hiding UI elements is not security.
- Authentication secrets and provider credentials must never be committed to Git.
- Login and recovery flows must not reveal whether an arbitrary email address exists.
- Rate limiting and secure session handling are required.
- MFA is recommended for production administrators.

**Authentication implementation decision:** Auth.js is selected, but the provider/session strategy must be confirmed before implementation. If using an OAuth/email provider with a Prisma adapter, database-backed sessions may be used. If using the Credentials provider, Auth.js uses JWT sessions; the application must implement password verification, account lookup, rate limiting, and provisioning explicitly. Do not assume Credentials automatically persists users or uses database sessions.

### 6.2 Dashboard

Show useful operational summaries:
- Total links, published links, drafts, and archived links.
- Active categories and media asset count/storage usage where available.
- Page views, estimated unique visitors, total link clicks, and CTR for the selected period.
- Top-performing links.
- Traffic trend overview.
- Recent administrative activity.
- Shortcuts to common CMS tasks.

Dashboard metrics must be derived from real stored data. Empty states must be clear for a new installation.

### 6.3 Link Management

Administrators can:
- Create, view, edit, duplicate, reorder, publish, unpublish, archive, restore, and delete links.
- Set title, description, URL, category, icon/thumbnail, tag, sort order, and featured state.
- Save content as draft.
- Validate URL syntax and allow only approved schemes such as HTTP and HTTPS (and approved `mailto:` destinations where relevant).
- Preview the currently published public website only. Draft content is not exposed through a public preview route in the initial release.
- See clear publication status and timestamps.
- Receive confirmation before destructive actions.

### 6.4 Category Management

Administrators can:
- Create, edit, reorder, activate/deactivate, archive, and delete categories.
- Set name, slug, description, icon, and sort order.
- Prevent deletion from orphaning links. The UI must require reassignment or a defined archive strategy when a category contains links.
- Ensure unique slugs.

### 6.5 Website Settings

Manage public content without editing code:
- General identity: site name and short description.
- Branding: approved logo and favicon assets.
- Header/navigation labels and destinations.
- Hero headline, subtitle, and CTA label/destination.
- Directory section heading and supporting copy.
- Contact CTA text, email, and verified contact links.
- Social destinations.
- Footer copy and footer links.
- SEO and Open Graph metadata.

CMS settings must not permit arbitrary script injection, raw HTML execution, or arbitrary CSS editing.

### 6.6 Media Library

- Upload, list, preview, replace, and delete approved media files.
- Store file metadata (original name, storage key, MIME type, byte size, dimensions where applicable, uploader, and timestamps).
- Validate file size and actual content type; do not trust filename extensions alone.
- Prevent path traversal and unsafe file handling.
- Avoid storing production uploads only inside an ephemeral application container.
- Use a storage abstraction so local development and production storage can differ.
- Production storage provider remains a deployment decision; prefer persistent storage or S3-compatible object storage with independent backup.

### 6.7 Admin Account Management

- List authorized admin accounts.
- Invite/provision an approved Flexbox member.
- Activate/deactivate access.
- Revoke sessions where supported.
- Record account and access changes in audit logs.
- Do not expose password hashes, authentication tokens, or provider secrets in the UI.

### 6.8 Audit Logs

Record security-relevant administrative activity, such as:
- Successful/failed authentication events where appropriate.
- Link/category create, update, publish, archive, and delete actions.
- Website settings changes.
- Media uploads/deletions.
- Admin invitations, activation, deactivation, and role changes.

Audit records should capture actor, action, entity type/ID, timestamp, and a safe summary of changed fields. Never store secrets or full sensitive payloads in audit logs.

## 7. Advanced Analytics Requirements

### 7.1 Core Events

At minimum:
- `PAGE_VIEW`
- `LINK_CLICK`
- `SESSION_START` (only if it provides meaningful reporting value)

Events should include an event ID, UTC timestamp, event type, optional link reference, anonymous session reference, normalized device type, normalized browser family, normalized operating-system family, and a limited referrer classification.

### 7.2 Metrics

- Page views.
- Estimated unique visitors.
- Sessions (if session definition is implemented).
- Total link clicks.
- Clicks per link.
- CTR (define numerator and denominator consistently).
- Returning/new visitor estimates where privacy-safe and meaningful.
- Popular links and ranking.
- Traffic and click trends.

Unique visitors are estimates based on privacy-conscious first-party identifiers, not verified human identities. Analytics must not claim perfect person-level accuracy.

### 7.3 Dimensions and Breakdowns

- Time period.
- Link/category.
- Device class: mobile, desktop, tablet, unknown.
- Browser family: Chrome, Safari, Firefox, Edge, other, unknown.
- Operating system family: Windows, macOS, Linux, Android, iOS, other, unknown.
- Referrer category where available.

Do not collect exact device fingerprints or unnecessary granular browser details.

### 7.4 Date Filters and Reports

- Today.
- Yesterday.
- Last 7 days.
- Last 30 days.
- Last 90 days.
- This month.
- Last month.
- Custom date range.
- CSV export for authorized administrators.

Use UTC timestamps in storage and a configurable reporting timezone. Default reporting timezone for Flexbox is `Asia/Jakarta`.

### 7.5 Privacy and Retention

- Do not persist raw IP addresses.
- Do not use canvas/audio/device fingerprinting.
- Prefer a random first-party visitor/session identifier with a limited lifetime.
- Store normalized device/browser/OS categories rather than detailed fingerprints.
- Avoid collecting full referrer URLs if they may contain query-string identifiers; store a sanitized origin or category.
- Exclude admin activity from public visitor metrics.
- Apply bot/noise filtering where feasible and document limitations.
- Initial raw event retention target: 90 days, subject to final privacy review. Daily aggregates may be retained longer.
- Provide an appropriate privacy notice and respect applicable consent/notice requirements.

### 7.6 Reliability

Analytics must not break navigation. If event recording fails, the visitor must still be able to reach the destination. The tracking endpoint must only redirect to a destination looked up from a valid, published link record; never accept an arbitrary redirect URL from the client.

## 8. Non-Functional Requirements

### Performance
- Public pages should be server-rendered or statically generated where practical.
- Keep JavaScript on the public page minimal.
- Use optimized images and fonts.
- Use database indexes for common CMS and analytics queries.
- Avoid N+1 database access patterns.

### Security
- Enforce authorization on the server for every admin action.
- Validate input on the server using shared schemas.
- Use parameterized ORM queries; never concatenate user input into SQL.
- Protect against XSS, CSRF, open redirects, injection, brute-force login, and insecure file uploads.
- Keep database ports private in production.
- Use HTTPS for public and admin traffic.
- Use secure, HTTP-only, SameSite cookies where applicable.
- Maintain backups and periodically test restoration.

### Reliability and Operations
- Health checks for application and database.
- Structured application logs without secrets or personal data.
- Database migration process that is repeatable and reviewed.
- Independent backups stored outside the production VPS.
- Documented restore and rollback procedures.

### Accessibility
- Target WCAG 2.2 AA.
- Semantic landmarks and heading structure.
- Keyboard navigation and visible focus states.
- Sufficient text contrast.
- Reduced-motion support.
- Responsive layout at 320px, 390px, 768px, 1024px, and 1280px.

## 9. Content States and Publication Rules

Recommended link states:
- `DRAFT`: editable in CMS, never shown publicly.
- `PUBLISHED`: shown publicly when the link and category are active.
- `ARCHIVED`: retained for records, hidden publicly.

Publication must be deliberate. Saving a draft does not publish it. Unpublishing must remove it from public queries and link tracking destinations.

## 10. Success Criteria

The first production release is acceptable when:
- The public microsite matches the approved visual direction and works on mobile/desktop.
- All public content can be maintained through the CMS without source-code changes.
- Only authorized, active Flexbox Super Admin accounts can access protected admin operations.
- Links and categories support complete lifecycle management.
- Website settings and media assets can be managed safely.
- Analytics reports page views, link clicks, trends, devices, browser/OS families, periods, and popular links using documented definitions.
- Analytics failure does not prevent link navigation.
- No public endpoint exposes drafts, private admin data, or database credentials.
- Local tests and production build pass, and deployment/backup/restore procedures are documented.

## 11. Open Decisions

The following items must be decided before the related implementation begins:
- Auth.js provider and session strategy (OAuth/database session vs Credentials/JWT).
- Admin invitation and identity verification workflow.
- Media storage provider for production.
- Final domain and public contact/social destinations.
- Final copy and approved public categories.
- Analytics cookie/session lifetime and final retention policy.
- Reporting timezone override policy (default: `Asia/Jakarta`).
- Whether an independent staging deployment is affordable in the initial VPS plan.
