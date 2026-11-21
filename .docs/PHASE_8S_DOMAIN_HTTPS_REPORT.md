# Phase 8S — Production Domain and HTTPS Report

Status: BLOCKED — PROVIDER ACTION REQUIRED

## DNS validation

- `microsite.flexbox.web.id A` resolves to `217.216.146.40` through both
  1.1.1.1 and 8.8.8.8.
- `www.microsite.flexbox.web.id CNAME` resolves to
  `microsite.flexbox.web.id` through both public resolvers.
- Current authoritative nameservers for `web.id`: `b.dns.id`, `c.dns.id`,
  `d.dns.id`, `e.dns.id`, and `f.dns.id`.
- SOA is currently served by `b.dns.id` with `hostmaster.pandi.id`; the
  previously observed malformed SOA was not reproduced in this audit.

## Network and HTTPS

- VPS-local Traefik listeners are present on TCP 80, 443, and administrative
  8080.
- A TCP check from the VPS to the public IP observed 80/443 open and 5432
  closed. This is not an independent external vantage point and does not
  prove provider NAT end-to-end.
- Public HTTP and HTTPS requests currently return HTTP 503 with the Coolify
  "Site not available" page, not the application.
- TLS presents `TRAEFIK DEFAULT CERT`, whose SAN does not contain the
  production hostname; no valid production certificate or redirect was
  accepted.
- The result is consistent with the absence of a production container and
  zero production deployment records, not with a DNS resolution failure.
- No DNS, NAT, firewall, SSH, or provider setting was changed.

## Required provider action

VPS Murah must link the production domain in its Domain & Website layer and
confirm forwarding of TCP 80/443 to the VPS/Traefik. Only after that and owner
approval should Coolify Let's Encrypt be enabled and the certificate, HTTP to
HTTPS redirect, canonical host, and WWW behavior be externally verified.
