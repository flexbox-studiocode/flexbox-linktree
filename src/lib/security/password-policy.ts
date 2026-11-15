/**
 * Administrator password policy constants.
 *
 * This module deliberately has no runtime dependencies and no `server-only`
 * import, so both Server Components and client forms can render the same limits
 * instead of hard-coding a second copy. The enforcement itself stays on the
 * server in `src/lib/security/password.ts`.
 */

/** Minimum accepted password length for administrator accounts. */
export const PASSWORD_MIN_LENGTH = 8;
/** Maximum accepted password length, to bound hashing cost from untrusted input. */
export const PASSWORD_MAX_LENGTH = 256;