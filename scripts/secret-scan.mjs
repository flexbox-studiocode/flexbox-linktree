#!/usr/bin/env node
/**
 * Tracked-file secret scan.
 *
 * Scans every file Git tracks for high-signal credential shapes: private keys,
 * cloud access-key IDs, inline session/rate-limit secrets, and PostgreSQL URLs
 * that embed credentials. Documentation placeholders and local development
 * credentials are allowlisted so the scan reports only likely real leaks.
 *
 * Usage:
 *   node scripts/secret-scan.mjs
 *
 * Exit code 1 when a finding is reported.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_BYTES = 512 * 1024;

const SKIP_FILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  ".env.example",
  // This scanner contains its own pattern text; scanning it would always match.
  "scripts/secret-scan.mjs",
]);

const PATTERNS = [
  { name: "private-key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: "aws-access-key", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "session-secret", regex: /\b(?:NEXTAUTH_SECRET|AUTH_SECRET)\s*=\s*["']?[A-Za-z0-9+/=_-]{24,}/ },
  { name: "rate-limit-secret", regex: /\bRATE_LIMIT_SECRET\s*=\s*["']?[A-Za-z0-9+/=_-]{24,}/ },
  { name: "analytics-secret", regex: /\bANALYTICS_HASH_SECRET\s*=\s*["']?[A-Za-z0-9+/=_-]{24,}/ },
  {
    name: "database-url-with-password",
    regex: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@[^\s"'`]+/,
  },
];

// Values that are documentation placeholders or the documented local container
// credentials are not secrets. This is intentionally narrow.
const ALLOWLIST = [
  /localhost/i,
  /127\.0\.0\.1/,
  /\[::1\]/,
  /<[^>]*>/,
  /change[-_ ]?me/i,
  /replace[-_ ]?me/i,
  /replace-with/i,
  /integration-test-/i,
  /lifecycle-test-/i,
  /your[-_ ]/i,
  /example/i,
  /placeholder/i,
  /postgres:flexbox@/i,
  /flexbox:flexbox@/i,
];

const listed = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });

if (listed.status !== 0) {
  console.error("secret-scan: cannot list tracked files. Run inside the repository.");
  process.exit(1);
}

const files = listed.stdout.split("\0").filter(Boolean);
const findings = [];
let scanned = 0;

for (const file of files) {
  if (SKIP_FILES.has(file)) continue;

  let buffer;

  try {
    buffer = readFileSync(file);
  } catch {
    continue;
  }

  if (buffer.length > MAX_BYTES || buffer.includes(0)) continue;

  scanned += 1;

  const lines = buffer.toString("utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      const match = line.match(pattern.regex);

      if (!match) continue;

      if (ALLOWLIST.some((allow) => allow.test(match[0]))) continue;

      findings.push({ file, line: index + 1, kind: pattern.name });
    }
  });
}

if (findings.length > 0) {
  console.error(`secret-scan: ${findings.length} potential secret(s) found.`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} (${finding.kind})`);
  }
  process.exit(1);
}

console.log(`secret-scan: ${scanned} tracked text file(s) scanned, no findings.`);