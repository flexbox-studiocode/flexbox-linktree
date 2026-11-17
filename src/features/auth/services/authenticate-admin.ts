import "server-only";

import { findAdminWithPasswordHash, recordFailedLoginForAdmin, recordSuccessfulLogin, storeRehashedPassword } from "@/features/auth/repositories/admin-user";
import { loginSchema } from "@/features/auth/schemas/login";
import { normalizeEmail } from "@/features/auth/schemas/identity";
import { checkLoginAllowed, recordFailedLogin, resetLoginThrottle, sourceBucketKey } from "@/features/auth/services/rate-limit";
import { recordSecurityEvent } from "@/features/auth/services/security-event";
import { hashPassword, needsRehash, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/security/password";

/** Credential-verification result. `null` deliberately covers every failure. */
export type AuthenticatedAdmin = {
  id: string;
  role: "SUPER_ADMIN";
  authVersion: number;
};

export type AuthenticateAdminInput = {
  email: unknown;
  password: unknown;
  sourceIdentifier?: string | null;
  now?: Date;
};

/**
 * Authenticates an administrator without disclosing why a sign-in was rejected.
 * The route hands in a source address only when its proxy configuration permits
 * trusting forwarded headers; raw addresses are converted to HMAC buckets only.
 */
export async function authenticateAdmin(input: AuthenticateAdminInput): Promise<AuthenticatedAdmin | null> {
  const parsed = loginSchema.safeParse({ email: input.email, password: input.password });

  // A malformed email has no stable account bucket. Keep the response generic.
  if (!parsed.success) {
    return null;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = normalizeEmail(email);
  const sourceKey = sourceBucketKey(
    { sourceIdentifier: input.sourceIdentifier ?? null },
    process.env.RATE_LIMIT_SECRET,
  );
  const allowed = await checkLoginAllowed({ normalizedEmail, sourceBucketKey: sourceKey, now: input.now });

  if (!allowed.allowed) {
    await recordSecurityEvent({
      eventType: "LOGIN_BLOCKED",
      metadata: { accountEmail: normalizedEmail, retryAfterSeconds: allowed.retryAfterSeconds },
    });
    return null;
  }

  const admin = await findAdminWithPasswordHash(normalizedEmail);
  // Always run one Argon2id verification, even when the account is unknown or
  // inactive, so response timing does not distinguish "no such account" from
  // "wrong password".
  const passwordMatches = await verifyPassword(admin?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
  const valid =
    admin?.status === "ACTIVE" && admin.role === "SUPER_ADMIN" && passwordMatches;

  if (!valid || !admin) {
    const failure = await recordFailedLogin({ normalizedEmail, sourceBucketKey: sourceKey, now: input.now });
    if (admin) {
      await recordFailedLoginForAdmin(admin.id);
    }
    await recordSecurityEvent({
      eventType: "LOGIN_FAILED",
      adminUserId: admin?.id,
      targetType: "admin_user",
      targetId: admin?.id,
      metadata: { accountEmail: normalizedEmail, attemptCount: failure.attemptCount },
    });
    return null;
  }

  if (needsRehash(admin.passwordHash)) {
    await storeRehashedPassword(admin.id, await hashPassword(password));
  }

  await Promise.all([
    resetLoginThrottle({ normalizedEmail, sourceBucketKey: sourceKey }),
    recordSuccessfulLogin(admin.id, input.now),
  ]);
  await recordSecurityEvent({
    eventType: "LOGIN_SUCCEEDED",
    adminUserId: admin.id,
    targetType: "admin_user",
    targetId: admin.id,
    metadata: { accountEmail: normalizedEmail },
  });

  return { id: admin.id, role: "SUPER_ADMIN", authVersion: admin.authVersion };
}
