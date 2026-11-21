#!/usr/bin/env node
/**
 * Production configuration preflight.
 *
 * Usage:
 *   pnpm config:check                                  # uses NODE_ENV and .env.local
 *   pnpm config:check --production                     # force production rules
 *   pnpm config:check --env-file .env.staging --production
 *
 * Exit code 1 when a blocking problem is found, 0 when only warnings remain.
 * Secret values are never printed; only names, lengths, and categories.
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const args = process.argv.slice(2);
const forcedProduction = args.includes("--production");
const envFileIndex = args.indexOf("--env-file");
const envFile = envFileIndex >= 0 ? args[envFileIndex + 1] : null;

function loadEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`config:check: env file not found: ${path}`);
    process.exit(1);
  }

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Real environment variables win over file values.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

if (envFile) {
  loadEnvFile(resolve(envFile));
} else if (!forcedProduction && process.env.NODE_ENV !== "production" && existsSync(".env.local")) {
  loadEnvFile(resolve(".env.local"));
}

const production = forcedProduction || process.env.NODE_ENV === "production";
const results = [];
let errors = 0;
let warnings = 0;

function record(level, label, detail) {
  results.push({ level, label, detail });

  if (level === "error") errors += 1;
  if (level === "warn") warnings += 1;
}

const ok = (label, detail) => record("ok", label, detail);
const warn = (label, detail) => record("warn", label, detail);
const error = (label, detail) => record("error", label, detail);

const PLACEHOLDER = /(change[-_ ]?me|replace[-_ ]?me|your[-_ ]|example\.com|placeholder|generate[-_ ]a[-_ ]secret)/i;

function present(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function checkSecret(name, minimumLength, { required = true } = {}) {
  const value = present(name);

  if (!value) {
    if (required) {
      error(name, "missing");
    } else {
      ok(name, "not set (optional)");
    }

    return null;
  }

  if (PLACEHOLDER.test(value)) {
    error(name, "value still looks like a placeholder");
    return value;
  }

  if (value.length < minimumLength) {
    error(name, `too short (${value.length} chars, need at least ${minimumLength})`);
    return value;
  }

  ok(name, `present (${value.length} chars)`);

  return value;
}

// 1. Runtime mode
record("info", "mode", production ? "production rules" : "development rules");
record("info", "source", envFile ? `env file ${envFile}` : "process environment");

// 2. Database
const databaseUrl = present("DATABASE_URL");

if (!databaseUrl) {
  error("DATABASE_URL", "missing");
} else {
  try {
    const parsed = new URL(databaseUrl);

    if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
      error("DATABASE_URL", `unexpected protocol ${parsed.protocol}`);
    } else if (!parsed.pathname || parsed.pathname === "/") {
      error("DATABASE_URL", "does not name a database");
    } else if (PLACEHOLDER.test(databaseUrl)) {
      error("DATABASE_URL", "contains a placeholder credential or host");
    } else {
      const host = parsed.hostname;
      const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";

      if (production && local) {
        error("DATABASE_URL", "production points at localhost; PostgreSQL must not be public and should be a managed or internal host");
      } else if (!parsed.password && !local) {
        warn("DATABASE_URL", "no password in the URL; confirm the deployment provides credentials another way");
      } else {
        ok("DATABASE_URL", `host ${host}, database ${parsed.pathname.replace(/^\//, "")}`);
      }
    }
  } catch {
    error("DATABASE_URL", "not a valid URL");
  }
}

// 3. Session and throttle secrets
const nextAuthSecret = checkSecret("NEXTAUTH_SECRET", 32, { required: false });
const authSecret = checkSecret("AUTH_SECRET", 32, { required: false });
const rateLimitSecret = checkSecret("RATE_LIMIT_SECRET", 32);

if (!nextAuthSecret && !authSecret) {
  error("session secret", "set NEXTAUTH_SECRET or AUTH_SECRET");
} else if (nextAuthSecret && authSecret && nextAuthSecret !== authSecret) {
  warn("session secret", "NEXTAUTH_SECRET and AUTH_SECRET differ; confirm which one Auth.js reads in this deployment");
}

if (rateLimitSecret && (rateLimitSecret === nextAuthSecret || rateLimitSecret === authSecret)) {
  warn("RATE_LIMIT_SECRET", "reuses the session secret; use a dedicated key");
}

// 4. Canonical URL
const nextAuthUrl = present("NEXTAUTH_URL");
const expectedProductionOrigin = "https://microsite.flexbox.web.id";

if (!nextAuthUrl) {
  error("NEXTAUTH_URL", "missing; recovery links and secure cookie prefixes cannot be derived");
} else {
  try {
    const parsed = new URL(nextAuthUrl);

    if (production && parsed.protocol !== "https:") {
      error("NEXTAUTH_URL", "production must use https");
    } else if (production && parsed.origin !== expectedProductionOrigin) {
      error("NEXTAUTH_URL", `production must use ${expectedProductionOrigin}`);
    } else if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      warn("NEXTAUTH_URL", "should be the bare origin without path, query, or fragment");
    } else {
      ok("NEXTAUTH_URL", parsed.origin);
    }
  } catch {
    error("NEXTAUTH_URL", "not a valid URL");
  }
}

// 5. Analytics hashing
const analyticsSecret = present("ANALYTICS_HASH_SECRET");

if (!analyticsSecret) {
  if (nextAuthSecret || authSecret) {
    warn("ANALYTICS_HASH_SECRET", "not set; the collector falls back to the session secret. A dedicated key is recommended.");
  } else {
    error("ANALYTICS_HASH_SECRET", "not set and no session secret fallback exists; analytics collection is disabled");
  }
} else if (analyticsSecret.length < 16) {
  error("ANALYTICS_HASH_SECRET", `too short (${analyticsSecret.length} chars, need at least 16)`);
} else if (analyticsSecret === nextAuthSecret || analyticsSecret === authSecret) {
  warn("ANALYTICS_HASH_SECRET", "equals the session secret; use a dedicated key so rotation is independent");
} else {
  ok("ANALYTICS_HASH_SECRET", `present (${analyticsSecret.length} chars)`);
}

// 6. Retention
for (const [name, minimum, maximum] of [
  ["ANALYTICS_RAW_RETENTION_DAYS", 1, 365],
  ["ANALYTICS_AGGREGATE_RETENTION_DAYS", 90, 1095],
]) {
  const raw = present(name);

  if (!raw) {
    ok(name, "not set (code default applies)");
  } else if (!/^\d+$/.test(raw)) {
    warn(name, "not an integer; the code default applies");
  } else {
    const value = Number(raw);

    if (value < minimum || value > maximum) {
      warn(name, `outside the documented range ${minimum}–${maximum}`);
    } else {
      ok(name, `${value} days`);
    }
  }
}

// 7. Media storage
const mediaDriver = present("MEDIA_STORAGE_DRIVER") ?? (production ? "s3" : "local");

if (production) {
  if (mediaDriver === "local") {
    const localRoot = present("MEDIA_LOCAL_ROOT");

    if (process.env.MEDIA_ALLOW_LOCAL_IN_PRODUCTION !== "true") {
      error("MEDIA_ALLOW_LOCAL_IN_PRODUCTION", "must be true only when Coolify mounts a persistent production media volume");
    } else if (!localRoot || !isAbsolute(localRoot)) {
      error("MEDIA_LOCAL_ROOT", "production local media storage requires an absolute path such as /data/flexbox/media");
    } else {
      ok("MEDIA_STORAGE_DRIVER", `local persistent (${resolve(localRoot)})`);
    }
  } else if (mediaDriver !== "s3") {
    error("MEDIA_STORAGE_DRIVER", "must be local with a persistent absolute mount or s3");
  } else {
    ok("MEDIA_STORAGE_DRIVER", "s3");
  }

  if (process.env.MEDIA_ALLOW_LOCAL_IN_PRODUCTION === "true" && mediaDriver !== "local") {
    error("MEDIA_ALLOW_LOCAL_IN_PRODUCTION", "must not be enabled in production");
  }

  if (mediaDriver === "s3") {
    for (const name of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
      if (present(name)) {
        ok(name, "present");
      } else {
        error(name, "missing for the s3 driver");
      }
    }

    if (!present("S3_REGION")) {
      warn("S3_REGION", "not set; the code defaults to us-east-1");
    }
  }
} else {
  ok("MEDIA_STORAGE_DRIVER", `${mediaDriver} (development)`);

  if (process.env.MEDIA_ALLOW_LOCAL_IN_PRODUCTION === "true") {
    warn("MEDIA_ALLOW_LOCAL_IN_PRODUCTION", "enabled; acceptable only for a temporary non-production environment");
  }
}

// 8. Administrator mail
const mailTransport = present("ADMIN_MAIL_TRANSPORT") ?? (production ? "" : "file");

if (production) {
  if (!mailTransport) {
    error("ADMIN_MAIL_TRANSPORT", "no transport configured; production password recovery and invitations cannot be delivered");
  } else if (mailTransport === "file") {
    error("ADMIN_MAIL_TRANSPORT", "file transport writes to disk and never delivers; configure a real provider");
  } else if (mailTransport === "resend") {
    checkSecret("RESEND_API_KEY", 20);
    if (process.env.RESEND_SENDER_VERIFIED !== "true") {
      error("RESEND_SENDER_VERIFIED", "must be true only after Resend verifies the sender domain");
    } else {
      ok("RESEND_SENDER_VERIFIED", "confirmed");
    }
    const sender = present("EMAIL_FROM");
    if (!sender || !/^\S+@\S+\.\S+$/.test(sender)) {
      error("EMAIL_FROM", "must be a valid verified sender address");
    } else {
      ok("EMAIL_FROM", sender);
    }
    ok("ADMIN_MAIL_TRANSPORT", "resend");
  } else if (mailTransport === "disabled") {
    warn(
      "ADMIN_MAIL_TRANSPORT",
      "disabled; password recovery is unavailable and invitations require the private CLI/token handoff",
    );
  } else {
    error("ADMIN_MAIL_TRANSPORT", `unsupported production transport: ${mailTransport}; use resend or implement a provider`);
  }
} else {
  ok("ADMIN_MAIL_TRANSPORT", mailTransport === "file" ? "file (development only)" : mailTransport);
}

// 9. Proxy trust and bootstrap
if (process.env.TRUST_PROXY_HEADERS === "true") {
  warn("TRUST_PROXY_HEADERS", "enabled; forwarded headers must be overwritten by a trusted reverse proxy");
} else {
  ok("TRUST_PROXY_HEADERS", "not enabled; forwarded client headers are ignored");
}

if (process.env.ADMIN_BOOTSTRAP_ENABLED === "true") {
  if (production) {
    error("ADMIN_BOOTSTRAP_ENABLED", "must be off in production; run the bootstrap CLI before opening traffic");
  } else {
    warn("ADMIN_BOOTSTRAP_ENABLED", "enabled; turn it off after the first administrator exists");
  }
}

// 10. Print report
const order = { error: 0, warn: 1, info: 2, ok: 3 };

for (const result of results.sort((a, b) => order[a.level] - order[b.level])) {
  const tag = result.level === "error" ? "ERROR" : result.level === "warn" ? "WARN " : result.level === "info" ? "INFO " : "OK   ";
  console.log(`${tag} ${result.label}: ${result.detail}`);
}

console.log("");
console.log(`config:check: ${errors} error(s), ${warnings} warning(s) — ${production ? "production" : "development"} rules`);

if (errors > 0) {
  process.exitCode = 1;
}
