/**
 * Minimal CLI argument and secret-input helpers for the Phase 4 admin commands.
 *
 * These commands are operational tooling, not application routes. They exist so
 * account provisioning can be performed deliberately from the owner's
 * terminal without introducing a public or authenticated HTTP bootstrap path.
 *
 * Secrets are accepted only from standard input or a process environment
 * variable so they never appear in shell history as arguments.
 */

export function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((argument) => argument.startsWith(prefix));

  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = argv.indexOf(`--${name}`);

  if (index >= 0 && index + 1 < argv.length) {
    const next = argv[index + 1];

    return next.startsWith("--") ? undefined : next;
  }

  return undefined;
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

/**
 * Reads a secret from standard input.
 *
 * Usage (PowerShell), which keeps the value out of command history:
 *
 *   Read-Host "Password" -AsSecureString | node -e "process.stdout.write(...)"
 *
 * In practice the documented commands pipe a secure prompt into the CLI, so the
 * value is never echoed by Node and never passed as argv.
 *
 * A trailing newline is stripped because piped input always ends with one; the
 * remaining content is used verbatim, including interior spaces.
 */
export async function readSecretFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new Error(
      "No password was piped into the command. Pass the password through standard input; never as an argument.",
    );
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

/** Reads a secret from an environment variable, or falls back to stdin. */
export async function resolveSecret(envName: string): Promise<string> {
  const fromEnv = process.env[envName];

  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return readSecretFromStdin();
}

/** Prints a message to stderr and exits with a non-zero code. */
export function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

/** Prints a success line. Never pass a secret or a raw token here. */
export function succeed(message: string): void {
  console.log(message);
}