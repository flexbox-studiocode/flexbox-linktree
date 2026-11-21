import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Administrator notification mail.
 *
 * The interface keeps auth flows independent from the transport. Development
 * uses a local file transport; production may use Resend after the sender
 * domain has been verified and the secret variables are configured.
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
 * Explicit production-safe no-email transport.
 *
 * This mode never writes or sends a message. Callers must inspect
 * `delivered=false` and present the affected workflow as unavailable or use
 * the documented private CLI path for invitations.
 */
export function createDisabledMailer(): AdminMailer {
  return {
    name: "disabled",
    async send() {
      return { delivered: false };
    },
  };
}

export function isAdminMailDisabled(): boolean {
  return process.env.ADMIN_MAIL_TRANSPORT === "disabled";
}

export function createResendMailer(
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.EMAIL_FROM,
): AdminMailer {
  if (!apiKey) throw new Error("RESEND_API_KEY is required for the Resend mail transport.");
  if (!from) throw new Error("EMAIL_FROM is required for the Resend mail transport.");
  if (process.env.NODE_ENV === "production" && process.env.RESEND_SENDER_VERIFIED !== "true") {
    throw new Error("Resend sender verification is not confirmed for production.");
  }

  return {
    name: "resend",
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.body,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`Resend rejected the message with HTTP ${response.status}.`);
      }

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
  if (isAdminMailDisabled()) {
    return createDisabledMailer();
  }

  if (process.env.ADMIN_MAIL_TRANSPORT === "file") {
    return createFileMailer();
  }

  if (process.env.ADMIN_MAIL_TRANSPORT === "resend") {
    return createResendMailer();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No supported administrator mail transport is configured. Set ADMIN_MAIL_TRANSPORT=resend with verified sender credentials.",
    );
  }

  return createFileMailer();
}
