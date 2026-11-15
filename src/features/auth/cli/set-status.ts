import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { prisma } from "@/lib/prisma/client";
import { readFlag } from "@/features/auth/cli/args";
import { findByNormalizedEmail } from "@/features/auth/repositories/admin-user";
import {
  LifecycleError,
  disableAdmin,
  reactivateAdmin,
  suspendAdmin,
} from "@/features/auth/services/account-lifecycle";
import { parseEmail } from "@/features/auth/schemas/identity";

/**
 * Changes an administrator account status from the operator terminal.
 *
 * Phase 4 has no CMS screen for account administration, so these transitions are
 * exposed as a CLI. Every transition revokes existing sessions by incrementing
 * `authVersion`, so the change takes effect on the next request.
 *
 * Examples:
 *
 *   pnpm admin:set-status --email=member@flexbox.example --status=SUSPENDED
 *   pnpm admin:set-status --email=member@flexbox.example --status=ACTIVE
 */
const TRANSITIONS = {
  SUSPENDED: suspendAdmin,
  DISABLED: disableAdmin,
  ACTIVE: reactivateAdmin,
} as const;

type StatusArgument = keyof typeof TRANSITIONS;

function isStatusArgument(value: string | null | undefined): value is StatusArgument {
  return typeof value === "string" && value in TRANSITIONS;
}

async function main(): Promise<void> {
  const emailFlag = readFlag(process.argv.slice(2), "email");
  const status = readFlag(process.argv.slice(2), "status");

  if (!emailFlag || !isStatusArgument(status)) {
    throw new LifecycleError(
      "invalid_transition",
      'Usage: pnpm admin:set-status --email="member@example.com" --status="SUSPENDED|DISABLED|ACTIVE"',
    );
  }

  const normalizedEmail = parseEmail(emailFlag);
  const admin = await findByNormalizedEmail(normalizedEmail);

  if (!admin) {
    throw new LifecycleError("not_found", `No administrator account exists for ${normalizedEmail}.`);
  }

  const result = await TRANSITIONS[status]({ adminUserId: admin.id });

  console.log("Account status updated.");
  console.log(`  email           : ${normalizedEmail}`);
  console.log(`  previous status : ${result.previousStatus}`);
  console.log(`  new status      : ${result.nextStatus}`);
  console.log(`  auth version    : ${result.authVersion} (existing sessions revoked)`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof LifecycleError) {
      console.error(`Status change failed (${error.code}): ${error.message}`);
    } else {
      console.error(`Status change failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
