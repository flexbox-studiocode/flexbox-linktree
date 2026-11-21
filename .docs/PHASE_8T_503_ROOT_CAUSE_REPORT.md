# Phase 8T — 503 Root Cause Report

Status: BLOCKED — PRODUCTION UPSTREAM NOT DEPLOYED

Audit date: 2026-11-21 UTC

## Evidence

- Public DNS A: `microsite.flexbox.web.id -> 217.216.146.40`.
- Public DNS WWW CNAME: `www.microsite.flexbox.web.id ->
  microsite.flexbox.web.id`.
- Public resolver results from 1.1.1.1 and 8.8.8.8 agree.
- SOA is served by `b.dns.id` with the current `.dns.id` authoritative set.
- Traefik is running healthy with entrypoints on TCP 80 and 443.
- The production application resource is configured with the correct FQDN,
  Dockerfile, port 3000, and `/api/health` check.
- Coolify reports production `container_present=false` and
  `status=exited:unhealthy`.
- Production deployment history contains zero records.
- No production Docker container or production Traefik Docker labels exist.
- The staging container remains separate and healthy.

## HTTP and TLS observations

- HTTP requests to the canonical and WWW hosts return HTTP 503 with the
  Coolify “Site not available” page.
- HTTPS requests also return HTTP 503.
- SNI certificate subject and issuer are both `TRAEFIK DEFAULT CERT`.
- The certificate SAN does not contain either production hostname.
- Traefik ACME storage was observed at mode 0600 with size 0 during this
  audit; no issued certificate was present there.
- Local requests forced to `127.0.0.1` reproduce the same 503, so this is not
  only a public DNS resolver problem.

## Root cause

The production hostname reaches the VPS proxy, but Coolify has no deployed
production upstream container/service for the configured route. Traefik (and
the Coolify error-page fallback) therefore returns 503. The default
certificate is presented because no production TLS certificate has been
issued/configured.

This diagnosis does not justify deploying production automatically. The
correct fix requires the owner-approved migration and first production
deployment, followed by a separate approved HTTPS/ACME verification.

## Not changed

No DNS, nameserver, NAT, firewall, SSH, certificate, database migration,
production deployment, or email operation was performed.
