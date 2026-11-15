import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Administrator notification mail.
 *
 * Phase 4 must deliver password-recovery links, but no transactional e-mail
 * provider has been approved yet. Rather than pretend, this module defines the
 * interface the application depends on and ships exactly one implementation:
 * a local, file-based transport that writes the message to
 * `.local-storage/mail/` (git-ignored). It refuses to run in production.
 *
 * Adding a real provider later means implementing `AdminMailer` and returning it
 * from `getAdminMailer()`; nothing in `src/features/auth` needs to change.
 *
 * The reset link contains a single-use token, so the file transport is only ever
 * active outside production and the payload is never written to the logger.
 */

export type AdminMailMessage = {
  to: string;
  subject: string;
  /** Plain-text body. May contain a single-use link. */
  body: string;
  /** Non-secret type tag used for file naming and diagnostics. */
  kind: "password_reset" | "invitation";
};

export type AdminMailer = {
  readonly name: string;
  send(message: AdminMailMessage): Promise<{ delivered: boolean }>;
};

const MAIL_DIRECTORY = resolve(process.cwd(), ".local-storage", "mail");

/** Strips characters that are unsafe in a Windows/POSIX filename. */
function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._@-]/g, "_").slice(0, 120);
}

export function createFileMailer(directory: string = MAIL_DIRECTORY): AdminMailer {
  return {
    name: "file",
    async send(message) {
      await mkdir(directory, { recursive: true });

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = join(directory, `${stamp}-${message.kind}-${safeFileName(message.to)}.json`);

      await writeFile(
        file,
        `${JSON.stringify({ ...message, createdAt: new Date().toISOString() }, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600 },
      );

      return { delivered: true };
    },
  };
}

/**
 * Resolves the mailer for the current environment.
 *
 * In production no transport exists yet, and failing loudly is safer than
 * discarding a recovery link: the caller records a security event and still
 * answers with the generic, non-enumerating message.
 */
export function getAdminMailer(): AdminMailer {
  if (process.env.ADMIN_MAIL_TRANSPORT === "file") {
    return createFileMailer();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No administrator mail transport is configured. Set ADMIN_MAIL_TRANSPORT or implement a provider before production.",
    );
  }

  return createFileMailer();
}
