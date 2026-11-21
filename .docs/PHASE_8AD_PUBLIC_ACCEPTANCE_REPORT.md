# Phase 8AD — Public Acceptance Report

Date: 2026-11-21 UTC
Status: **PARTIAL PASS — OWNER AUTHENTICATED TEST REQUIRED**

## Results

- `https://microsite.flexbox.web.id/`: HTTP 200.
- `https://microsite.flexbox.web.id/api/health`: HTTP 200; database/storage `ok`.
- `https://www.microsite.flexbox.web.id/`: redirect to canonical HTTPS.
- HTTP canonical: redirect to HTTPS.
- HTTPS certificates: trusted Let's Encrypt certificates for both hostnames.
- `/robots.txt`, `/sitemap.xml`, and `/admin/login`: HTTP 200.
- Unauthenticated protected admin routes redirect to `/admin/login`.
- Public PostgreSQL TCP 5432: not reachable.
- Owner authenticated login, CMS CRUD, and production media upload tests were
  not run by automation because the owner password must not be shared in chat.

No email was sent. No production data was created or deleted during testing.

## Acceptance gate

The public website is deployed and reachable. The owner must complete the
authenticated login/CMS/media smoke test manually, without sharing credentials.
