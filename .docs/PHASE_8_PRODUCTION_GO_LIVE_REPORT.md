# Phase 8 Production Go-Live Report

Status: **NOT YET DEPLOYED**

## Current state

- Coolify project, production environment, destination, PostgreSQL resource,
  application resource, media mount, and protected environment metadata are
  provisioned.
- PostgreSQL 17 is healthy and private; target database and least-privilege
  role exist.
- Application deployment history is empty and no application container exists.
- No production migration, seed, administrator bootstrap, public deployment,
  HTTPS issuance, DNS change, NAT change, or production email was performed.

## Blocking prerequisites

- Run the repository verification/build pipeline in a Node.js 24 / pnpm
  12.18.0 build environment.
- Determine application runtime UID/GID and validate media write/read
  persistence in an isolated staging deployment.
- Provide and verify Resend sender-domain credentials before enabling email.
- Resolve the provider DNS SOA issue and independently confirm TCP 80/443 NAT.
- Complete staging with an isolated database and media path.
- Obtain explicit approval for production migration and first public deploy.

## Security status

- PostgreSQL has no public host port.
- Coolify API token is stored outside Git in a root-only secret file.
- Application secret values are stored as hidden Coolify environment variables.
- No secrets, database dumps, media, or runtime files were added to Git.
- Coolify and Traefik administrative exposure still requires final access-control
  review; no firewall or SSH change was made.

## Read-only public/network follow-up

- Public resolvers `1.1.1.1` and `8.8.8.8` returned A
  `microsite.flexbox.web.id -> 217.216.146.40` and CNAME
  `www.microsite.flexbox.web.id -> microsite.flexbox.web.id`.
- Authoritative NS remain `ns1.dnama.id` and `ns2.dnama.id`.
- The zone SOA still reports `a.misconfigured.dns.server.invalid` and must be
  corrected by the DNS provider.
- A request to the public HTTP hostname returned `404 Not Found`; this is not
  treated as an application success because no deployment/container exists.
- HTTPS returned no certificate and the TLS handshake failed. SSL is therefore
  not ready and no live claim is made.
- Local Coolify port 8000 returned the expected login redirect. No firewall,
  NAT, SSH, DNS, or management-port change was made. Provider mapping for
  public management access and TCP 80/443 still requires independent provider
  confirmation.

## Final status

**PROVISIONED BUT NOT DEPLOYED — no public production verification is claimed.**
