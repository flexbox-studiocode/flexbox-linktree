# Phase 8R — Production Administrator Bootstrap Report

Status: NOT RUN / OWNER ACTION REQUIRED

## Implementation audit

- Bootstrap is CLI-only; there is no public registration endpoint.
- `pnpm admin:bootstrap` requires temporary
  `ADMIN_BOOTSTRAP_ENABLED=true`.
- It refuses to run when any administrator already exists.
- Email and password are supplied through environment/stdin handling; the
  password is not an argument and is not printed.
- Passwords use the repository's Argon2id flow.
- The created account is an active `SUPER_ADMIN` and is marked verified without
  sending email.
- The bootstrap flag must be removed immediately after the one-time command.

## Current state

Production has not been migrated, so the administrator tables do not exist and
no production administrator account exists. Bootstrap was not attempted.

## Required owner procedure after migration approval

The owner must provide the intended administrator email/name and enter a
strong unique password interactively through the approved CLI procedure. Do
not use a default password, invitation token, email transport, or a shell
argument. After successful bootstrap, remove `ADMIN_BOOTSTRAP_ENABLED` and
verify `/admin/login` only after the production container is healthy.
