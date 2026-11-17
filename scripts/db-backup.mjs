#!/usr/bin/env node
/**
 * Creates a custom-format PostgreSQL backup and a SHA-256 sidecar.
 *
 * Usage:
 *   pnpm db:backup                 # local development database
 *   pnpm db:backup --production    # required when DATABASE_URL is not local
 *
 * Resolution order for the dump binary:
 *   1. PG_DUMP_BIN (absolute path or command name)
 *   2. pg_dump on PATH
 *   3. pg_dump inside BACKUP_CONTAINER (default `flexbox-linktree-db`)
 *
 * Environment:
 *   DATABASE_URL       required; loaded from .env.local when not already set
 *   BACKUP_DIR         default `backups`
 *   BACKUP_KEEP        default 14 (older `db-*.dump` files are pruned)
 *   BACKUP_CONTAINER   docker container that can reach the database
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

function fail(message) {
  console.error(`db:backup: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail("DATABASE_URL is not set. Create .env.local or export it before running.");
}

let parsed;

try {
  parsed = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL is not a valid URL.");
}

const database = parsed.pathname.replace(/^\//, "");

if (!database) {
  fail("DATABASE_URL does not name a database.");
}

const user = decodeURIComponent(parsed.username || "postgres");
const password = decodeURIComponent(parsed.password || "");
const host = parsed.hostname;
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";

if (!isLocal && !process.argv.includes("--production")) {
  fail("DATABASE_URL points at a non-local host. Re-run with --production to confirm.");
}

const backupDir = resolve(process.env.BACKUP_DIR ?? "backups");
mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpName = `db-${timestamp}.dump`;
const dumpPath = join(backupDir, dumpName);

function hasCommand(command) {
  try {
    const result = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });

    return result.status === 0;
  } catch {
    return false;
  }
}

function containerExists(name) {
  try {
    const result = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", name], {
      encoding: "utf8",
    });

    return result.status === 0 && result.stdout.trim() === "true";
  } catch {
    return false;
  }
}

let strategy;

if (process.env.PG_DUMP_BIN) {
  strategy = { kind: "binary", command: process.env.PG_DUMP_BIN, args: [] };
} else if (hasCommand("pg_dump")) {
  strategy = { kind: "binary", command: "pg_dump", args: [] };
} else {
  if (!isLocal) {
    fail("No local pg_dump is available for a non-local DATABASE_URL. Set PG_DUMP_BIN to a PostgreSQL 17 client binary.");
  }

  const container = process.env.BACKUP_CONTAINER ?? "flexbox-linktree-db";

  if (!containerExists(container)) {
    fail(
      "No pg_dump on PATH and no running BACKUP_CONTAINER. Install PostgreSQL client tools or start the local container.",
    );
  }

  strategy = {
    kind: "docker",
    command: "docker",
    args: ["exec", "-i", ...(password ? ["-e", `PGPASSWORD=${password}`] : []), container],
  };
}

const commonArgs = [
  "--format=custom",
  "--no-owner",
  "--no-privileges",
  "--username",
  user,
  "--dbname",
  database,
];

const args =
  strategy.kind === "docker"
    ? [...strategy.args, "pg_dump", ...commonArgs]
    : [...commonArgs, `--host=${host}`, `--port=${parsed.port || "5432"}`];

console.log(`db:backup: dumping ${database} via ${strategy.kind === "docker" ? "docker exec" : strategy.command}`);

const startedAt = Date.now();
const child = spawn(strategy.command, args, {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, ...(password ? { PGPASSWORD: password } : {}) },
});

const output = createWriteStream(dumpPath);
const hash = createHash("sha256");
let bytes = 0;
let stderr = "";

child.stdout.on("data", (chunk) => {
  bytes += chunk.length;
  hash.update(chunk);
  output.write(chunk);
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

output.on("error", (error) => {
  fail(`cannot write ${dumpPath}: ${error.message}`);
});

child.on("error", (error) => {
  fail(`cannot start ${strategy.command}: ${error.message}`);
});

child.on("close", (code) => {
  output.end(() => {
    if (code !== 0) {
      rmSync(dumpPath, { force: true });
      fail(`pg_dump exited with ${code}: ${stderr.trim() || "no stderr"}`);
    }

    const digest = hash.digest("hex");

    if (bytes === 0) {
      rmSync(dumpPath, { force: true });
      fail("pg_dump produced an empty file.");
    }

    const checksumPath = `${dumpPath}.sha256`;
    const line = `${digest}  ${basename(dumpPath)}\n`;

    writeFileSync(checksumPath, line, "utf8");

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`db:backup: wrote ${dumpPath}`);
    console.log(`db:backup: ${(bytes / 1024 / 1024).toFixed(2)} MiB in ${seconds}s`);
    console.log(`db:backup: sha256 ${digest}`);

    pruneOldBackups();
  });
});

function pruneOldBackups() {
  const keep = Number(process.env.BACKUP_KEEP ?? "14");

  if (!Number.isInteger(keep) || keep < 1) {
    console.warn("db:backup: BACKUP_KEEP is not a positive integer; skipping prune.");
    return;
  }

  const dumps = readdirSync(backupDir)
    .filter((name) => /^db-.*\.dump$/.test(name))
    .map((name) => ({ name, path: join(backupDir, name), mtime: statSync(join(backupDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const stale of dumps.slice(keep)) {
    rmSync(stale.path, { force: true });
    rmSync(`${stale.path}.sha256`, { force: true });
    console.log(`db:backup: pruned ${stale.name}`);
  }
}