import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

import { prisma } from "@/lib/prisma/client";
import { cleanupExpiredRateLimits } from "@/features/auth/services/rate-limit";
import { deleteExpiredResetTokens } from "@/features/auth/repositories/password-reset-token";
import { recordSecurityEvent } from "@/features/auth/services/security-event";

/**
 * Removes expired ephemeral authentication records.
 *
 * Only rows whose own retention horizon has passed are touched:
 *   - `admin_rate_limits`, whose `expires_at` is set past its lockout window;
 *   - `password_reset_tokens`, whose `expires_at` has passed.
 *
 * Invitations, security events, and accounts are deliberately retained: they are
 * the audit trail, not transient state.
 *
 * Example:
 *
 *   pnpm admin:cleanup
 */
async function main(): Promise<void> {
  const rateLimitBuckets = await cleanupExpiredRateLimits();
  const resetTokens = await deleteExpiredResetTokens();

  await recordSecurityEvent({
    eventType: "RATE_LIMIT_CLEANUP",
    metadata: { removedBuckets: rateLimitBuckets, removedResetTokens: resetTokens },
  });

  console.log("Authentication cleanup complete.");
  console.log(`  rate-limit buckets removed : ${rateLimitBuckets}`);
  console.log(`  expired reset tokens       : ${resetTokens}`);
}

main()
  .catch((error: unknown) => {
    console.error(`Cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
