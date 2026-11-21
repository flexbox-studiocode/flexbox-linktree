# Phase 8AC — HTTPS Report

Date: 2026-11-21 UTC
Status: **PASS — HTTPS VERIFIED**

## Read-only evidence

- `microsite.flexbox.web.id` resolves to `217.216.146.40`.
- `www.microsite.flexbox.web.id` resolves to `217.216.146.40` through the
  configured alias.
- Local Traefik listens on TCP 80 and 443.
- Canonical HTTPS returns HTTP 200.
- HTTP redirects to HTTPS.
- WWW redirects to the canonical HTTPS hostname.
- Both hostnames have trusted Let's Encrypt certificates.

## Cause and next gate

The production router is active after the successful Coolify deployment. Both
Traefik HTTPS services target internal port 3000 and use the `letsencrypt`
resolver.

No DNS, NAT, firewall, SSH, nameserver, Certbot, or `acme.json` change was
made. After the application deploys successfully, recheck HTTP-01 reachability
and issue the certificate through Coolify/Traefik only.
