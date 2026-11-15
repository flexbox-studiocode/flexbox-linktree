import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { prisma } from "@/lib/prisma/client";
import { acceptInvitation, ProvisioningError } from "@/features/auth/services/provisioning";
import { readFlag, resolveSecret } from "@/features/auth/cli/args";

/**
 * Activates an invited administrator account with a password.
 *
 * The raw invitation token and the password are both supplied through standard
 * input so neither appears in shell history or in the process argument list.
 *
 * Example (PowerShell):
 *
 *   $env:INVITATION_TOKEN = "the-token-from-admin:invite"
 *   Read-Host "Password" -AsSecureString | ConvertFrom-SecureString -AsPlainText |
 *     pnpm admin:accept-invite
 *   Remove-Item Env:INVITATION_TOKEN
 *
 * The command prints only the account id and email. It never echoes the token
 * or the password.
 */
async function main(): Promise<void> {
  const token = process.env.INVITATION_TOKEN ?? readFlag(process.argv.slice(2), "token");

  if (!token) {
    throw new ProvisioningError(
      "invalid_or_expired_invitation",
      "Set INVITATION_TOKEN in the environment for this command, or pass --token=<value>.",
    );
  }

  const password = await resolveSecret("INVITATION_PASSWORD");
  const fullName = readFlag(process.argv.slice(2), "name");

  if (password.length === 0) {
    throw new ProvisioningError("invalid_password", "No password was provided on standard input.");
  }

  const result = await acceptInvitation({ token, password, fullName });

  console.log("Invitation accepted. The account is now ACTIVE.");
  console.log(`  admin id : ${result.adminUserId}`);
  console.log(`  email    : ${result.normalizedEmail}`);
  console.log("");
  console.log("Sign in at /admin/login.");
}

main()
  .catch((error: unknown) => {
    if (error instanceof ProvisioningError) {
      console.error(`Activation failed (${error.code}): ${error.message}`);
    } else {
      console.error(`Activation failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });