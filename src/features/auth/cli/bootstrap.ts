import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { prisma } from "@/lib/prisma/client";
import { canBootstrap, bootstrapFirstSuperAdmin, ProvisioningError } from "@/features/auth/services/provisioning";
import { resolveSecret } from "@/features/auth/cli/args";

/**
 * Creates the first Super Admin account.
 *
 * This is the only way to create the very first administrator, and it is
 * deliberately:
 *
 *   - CLI-only: there is no HTTP route that can bootstrap an administrator.
 *   - Gated: it refuses to run unless `ADMIN_BOOTSTRAP_ENABLED=true` is set for
 *     this single command, so a forgotten variable cannot silently re-open
 *     access after the initial setup.
 *   - One-time: it refuses to run at all once any administrator row exists.
 *   - Non-default: no account, email, or password is ever shipped.
 *
 * The password is read from standard input (or `ADMIN_BOOTSTRAP_PASSWORD`) so it
 * never lands in shell history as an argument. It is never printed.
 *
 * Example (PowerShell):
 *
 *   $env:ADMIN_BOOTSTRAP_ENABLED = "true"
 *   $env:ADMIN_BOOTSTRAP_EMAIL  = "owner@flexbox.example"
 *   $env:ADMIN_BOOTSTRAP_NAME   = "Flexbox Owner"
 *   Read-Host "Password" -AsSecureString | ConvertFrom-SecureString -AsPlainText |
 *     pnpm admin:bootstrap
 *   Remove-Item Env:ADMIN_BOOTSTRAP_ENABLED
 */
async function main(): Promise<void> {
  const state = await canBootstrap();

  if (state.administrators > 0) {
    throw new ProvisioningError(
      "existing_account",
      "An administrator account already exists. Use `pnpm admin:invite` for additional members.",
    );
  }

  if (!state.enabled) {
    throw new ProvisioningError(
      "bootstrap_disabled",
      "Set ADMIN_BOOTSTRAP_ENABLED=true for this single command only.",
    );
  }

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const fullName = process.env.ADMIN_BOOTSTRAP_NAME;

  if (!email || !fullName) {
    throw new ProvisioningError(
      "invalid_email",
      "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_NAME for this command.",
    );
  }

  const password = await resolveSecret("ADMIN_BOOTSTRAP_PASSWORD");

  if (password.length === 0) {
    throw new ProvisioningError("invalid_password", "No password was provided on standard input.");
  }

  const result = await bootstrapFirstSuperAdmin({ email, fullName, password });

  console.log("First Super Admin created.");
  console.log(`  admin id : ${result.adminId}`);
  console.log(`  email    : ${result.normalizedEmail}`);
  console.log(`  name     : ${result.fullName}`);
  console.log("  status   : ACTIVE (email marked verified; no email was sent)");
  console.log("");
  console.log("Remove ADMIN_BOOTSTRAP_ENABLED from the environment before continuing.");
  console.log("Sign in at /admin/login with the password you entered.");
}

main()
  .catch((error: unknown) => {
    if (error instanceof ProvisioningError) {
      console.error(`Bootstrap failed (${error.code}): ${error.message}`);
    } else {
      // Never print a stack trace that could contain a connection string.
      console.error(`Bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });