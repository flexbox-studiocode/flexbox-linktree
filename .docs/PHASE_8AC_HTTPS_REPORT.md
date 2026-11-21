# Phase 8AC — HTTPS Report

Date: 2026-11-21 UTC
Status: **BLOCKED — NO PRODUCTION ROUTER**

## Read-only evidence

- `microsite.flexbox.web.id` resolves to `217.216.146.40`.
- `www.microsite.flexbox.web.id` resolves to `217.216.146.40` through the
  configured alias.
- Local Traefik listens on TCP 80 and 443.
- External requests reach the VPS but return HTTP 503.
- HTTPS presents `TRAEFIK DEFAULT CERT`; it is not a certificate for either
  microsite hostname.

## Cause and next gate

No production container exists because both Coolify deployment attempts failed
before runtime creation. Consequently, no production router can serve the
application and Let's Encrypt cannot complete the application certificate
flow.

No DNS, NAT, firewall, SSH, nameserver, Certbot, or `acme.json` change was
made. After the application deploys successfully, recheck HTTP-01 reachability
and issue the certificate through Coolify/Traefik only.
