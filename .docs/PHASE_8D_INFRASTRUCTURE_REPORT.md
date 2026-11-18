# Phase 8D Infrastructure Security and DNS Report

Status: **NOT YET DEPLOYED**

## DNS

- `microsite.flexbox.web.id A 217.216.146.40`: authoritative and public
  resolver checks pass.
- `www.microsite.flexbox.web.id CNAME microsite.flexbox.web.id.`:
  authoritative and both 1.1.1.1 and 8.8.8.8 currently return the approved
  target.
- SOA still reports `a.misconfigured.dns.server.invalid`; provider correction
  is required even though the application records answer.
- No DNS or nameserver changes were made.

## NAT and networking

- VPS interface: private `10.10.1.7/22`.
- Default gateway: `10.10.0.1`.
- Public address supplied by provider: `217.216.146.40`.
- Host ports 80 and 443 are owned by Coolify Traefik.
- Provider-level NAT forwarding cannot be proven from inside the VPS; provider
  confirmation is still required for public TCP 80/443.

## Security findings

- Coolify is bound to host port 8000; the previously supplied provider mapping
  is public port 30002 to VPS port 8000.
- Traefik is bound to host port 8080. Dashboard exposure/access control needs
  provider review.
- SSH remains on port 22; no SSH or firewall change was made.
- No host listener on PostgreSQL port 5432 was found.
- Existing Coolify containers are healthy. No FlexBox application container
  exists yet.

## Capacity

- 2 vCPU, 3.8 GiB RAM total, approximately 2.6 GiB available.
- 38 GiB root filesystem, approximately 29 GiB available, 25% used.
- No swap configured.
- Capacity is reasonable for a small private PostgreSQL 17 resource plus the
  application, but memory monitoring and disk alerts are required.
