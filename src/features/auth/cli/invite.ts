import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { prisma } from "@/lib/prisma/client";
import {
  createInvitationForAdmin,
  ProvisioningError,
} from "@/features/auth/services/provisioning";
import { readFlag } from "@/features/auth/cli/args";

/**
 * Issues an invitation for an additional Flexbox administrator.
 *
 * This is the current delivery path for invitations because no transactional
 * email provider is configured. The raw token is printed exactly once to this
 * terminal; it is never stored, never logged, and must be delivered to the
 * invited member through an approved private channel.
 *
 * When an email provider is added, this command will hand the token to that
 * provider instead of printing it.
 *
 * Example:
 *
 *   pnpm admin:invite --email=member@flexbox.example --name="Flexbox Member"
 */
async function main(): Promise<void> {
  const email = readFlag(process.argv.slice(2), "email");
  const fullName = readFlag(process.argv.slice(2), "name");

  if (!email || !fullName) {
    throw new ProvisioningError(
      "invalid_email",
      'Usage: pnpm admin:invite --email="member@example.com" --name="Member Name"',
    );
  }

  const result = await createInvitationForAdmin({ email, fullName });

  console.log("Invitation created. It is single-use and expires automatically.");
  console.log(`  invitation id : ${result.invitationId}`);
  console.log(`  email         : ${result.normalizedEmail}`);
  console.log(`  expires at    : ${result.expiresAt.toISOString()}`);
  console.log("");
  console.log("Deliver this activation token privately. It will not be shown again:");
  console.log("");
  console.log(`  ${result.token}`);
  console.log("");
  console.log("The invited member activates the account with:");
  console.log(`  pnpm admin:accept-invite --email="${result.normalizedEmail}"`);
  console.log("and pipes a password into the command when prompted.");
}

main()
  .catch((error: unknown) => {
    if (error instanceof ProvisioningError) {
      console.error(`Invitation failed (${error.code}): ${error.message}`);
    } else {
      console.error(`Invitation failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });