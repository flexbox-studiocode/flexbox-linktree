# Phase 8AD — Public Acceptance Report

Date: 2026-11-21 UTC
Status: **NOT RUN — PRODUCTION NOT DEPLOYED**

## Results

- `http://microsite.flexbox.web.id/api/health`: HTTP 503.
- `https://microsite.flexbox.web.id/api/health`: HTTP 503.
- `https://www.microsite.flexbox.web.id/api/health`: HTTP 503.
- HTTPS certificate: Traefik default certificate; hostname validation failed.
- Public PostgreSQL TCP 5432: not reachable.
- Admin login, CMS CRUD, media upload, and authenticated acceptance tests: not
  run because there is no production application container.

No email was sent. No production data was created or deleted during testing.

## Acceptance gate

Production is not live. Repeat all public, authentication, media, and HTTPS
acceptance tests only after a diagnosed Coolify deployment succeeds.
