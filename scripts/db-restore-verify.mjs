#!/usr/bin/env node
/**
 * Restores a backup into an isolated PostgreSQL container and verifies it.
 *
 * Usage:
 *   pnpm db:restore:verify                       # newest dump in backups/
 *   pnpm db:restore:verify backups/db-*.dump     # explicit file
 *   pnpm db:restore:verify --keep                # leave the container running
 *   pnpm db:restore:verify --replace             # reuse an existing verify container
 *
 * Verification compares, for every public table, the row count in the source
 * database and the restored database, then compares the Prisma migration ledger.
 * The script exits non-zero on any mismatch or restore error.
 *
 * The source database is never touched. The verification container is created
 * with a name that always ends in `-restore-db` and is removed unless --keep is
 * passed. It binds 127.0.0.1:5434 so it cannot collide with the development
 * database on 5433.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const CONTAINER = "flexbox-linktree-restore-db";
const IMAGE = "postgres:17-alpine";
const PORT = "5434";
const DB = "flexbox_linktree_restore";
const USER = "flexbox";
const PASSWORD = "flexbox";

function fail(message) {
  console.error(`db:restore:verify: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: options.binary ? "buffer" : "utf8", ...options });

  return result;
}

function docker(args, options = {}) {
  return run("docker", args, options);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail("DATABASE_URL is not set. Create .env.local or export it before running.");
}

const source = new URL(databaseUrl);
const sourceDb = source.pathname.replace(/^\//, "");
const sourceUser = decodeURIComponent(source.username || "postgres");
const sourcePassword = decodeURIComponent(source.password || "");

const keep = process.argv.includes("--keep");
const replace = process.argv.includes("--replace");
const explicitPath = process.argv.find((argument) => argument.endsWith(".dump"));

const backupDir = resolve(process.env.BACKUP_DIR ?? "backups");

function newestDump() {
  if (!existsSync(backupDir)) {
    fail(`no backup directory at ${backupDir}; run pnpm db:backup first.`);
  }

  const dumps = readdirSync(backupDir)
    .filter((name) => /^db-.*\.dump$/.test(name))
    .map((name) => ({ name, path: join(backupDir, name), mtime: statSync(join(backupDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (dumps.length === 0) {
    fail(`no db-*.dump files in ${backupDir}; run pnpm db:backup first.`);
  }

  return dumps[0].path;
}

const dumpPath = explicitPath ? resolve(explicitPath) : newestDump();

if (!existsSync(dumpPath)) {
  fail(`backup not found: ${dumpPath}`);
}

const checksumPath = `${dumpPath}.sha256`;

if (existsSync(checksumPath)) {
  const expected = readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(readFileSync(dumpPath)).digest("hex");

  if (expected !== actual) {
    fail(`checksum mismatch for ${basename(dumpPath)} (expected ${expected}, got ${actual}).`);
  }

  console.log(`db:restore:verify: checksum OK (${actual.slice(0, 16)}…)`);
} else {
  console.warn("db:restore:verify: no .sha256 sidecar; skipping checksum.");
}

if (docker(["inspect", "-f", "{{.State.Running}}", CONTAINER]).status === 0) {
  if (!replace) {
    fail(`container ${CONTAINER} already exists. Re-run with --replace to recreate it.`);
  }

  const removed = docker(["rm", "-f", CONTAINER]);

  if (removed.status !== 0) {
    fail(`cannot remove existing container: ${removed.stderr}`);
  }
}

console.log(`db:restore:verify: starting ${CONTAINER} (${IMAGE}) on 127.0.0.1:${PORT}`);

const started = docker([
  "run",
  "-d",
  "--name",
  CONTAINER,
  "-e",
  `POSTGRES_USER=${USER}`,
  "-e",
  `POSTGRES_PASSWORD=${PASSWORD}`,
  "-e",
  `POSTGRES_DB=${DB}`,
  "-p",
  `127.0.0.1:${PORT}:5432`,
  IMAGE,
]);

if (started.status !== 0) {
  fail(`cannot start container: ${started.stderr}`);
}

const cleanup = () => {
  if (keep) {
    console.log(`db:restore:verify: --keep set; ${CONTAINER} left running on 127.0.0.1:${PORT}.`);
    return;
  }

  const removed = docker(["rm", "-f", CONTAINER]);

  if (removed.status === 0) {
    console.log(`db:restore:verify: removed ${CONTAINER}.`);
  }
};

function sleep(ms) {
  // Synchronous sleep without spawning a process: this script is sequential.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForReady(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const ready = docker(["exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", USER, "-d", DB]);

    if (ready.status === 0) {
      return true;
    }

    sleep(500);
  }

  return false;
}

if (!waitForReady()) {
  cleanup();
  fail("verification database did not become ready in time.");
}

console.log("db:restore:verify: restoring dump");

const restore = docker(
  ["exec", "-i", "-e", `PGPASSWORD=${PASSWORD}`, CONTAINER, "pg_restore", "-h", "127.0.0.1", "--no-owner", "--no-privileges", "--exit-on-error", "-U", USER, "-d", DB],
  { input: readFileSync(dumpPath), binary: true },
);

if (restore.status !== 0) {
  cleanup();
  fail(`pg_restore failed: ${restore.stderr?.toString().trim() || "no stderr"}`);
}

function query(container, database, user, password, sql) {
  const result = docker(
    ["exec", "-i", "-e", `PGPASSWORD=${password}`, container, "psql", "-h", "127.0.0.1", "-U", user, "-d", database, "-t", "-A", "-F", "|", "-c", sql],
  );

  if (result.status !== 0) {
    fail(`psql failed in ${container}: ${result.stderr.trim()}`);
  }

  return result.stdout.trim();
}

function publicTables(container, database, user, password) {
  return query(
    container,
    database,
    user,
    password,
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  )
    .split("\n")
    .filter(Boolean);
}

const sourceContainer = "flexbox-linktree-db";

if (docker(["inspect", "-f", "{{.State.Running}}", sourceContainer]).status !== 0) {
  cleanup();
  fail(`source container ${sourceContainer} is not available; start it with docker compose up -d postgres.`);
}

const sourceTables = publicTables(sourceContainer, sourceDb, sourceUser, sourcePassword);
const restoredTables = publicTables(CONTAINER, DB, USER, PASSWORD);

if (sourceTables.join(",") !== restoredTables.join(",")) {
  cleanup();
  fail(`table set differs.\nsource:   ${sourceTables.join(", ")}\nrestored: ${restoredTables.join(", ")}`);
}

let mismatches = 0;
const rows = [];

for (const table of sourceTables) {
  const quoted = `"${table.replace(/"/g, '""')}"`;
  const sourceCount = query(sourceContainer, sourceDb, sourceUser, sourcePassword, `SELECT count(*) FROM ${quoted}`);
  const restoredCount = query(CONTAINER, DB, USER, PASSWORD, `SELECT count(*) FROM ${quoted}`);
  const ok = sourceCount === restoredCount;

  if (!ok) {
    mismatches += 1;
  }

  rows.push({ table, sourceCount, restoredCount, ok });
}

const sourceMigrations = query(
  sourceContainer,
  sourceDb,
  sourceUser,
  sourcePassword,
  'SELECT count(*) || \'|\' || coalesce(max(migration_name), \'\') FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
);
const restoredMigrations = query(
  CONTAINER,
  DB,
  USER,
  PASSWORD,
  'SELECT count(*) || \'|\' || coalesce(max(migration_name), \'\') FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
);

console.log("");
console.log("table".padEnd(30), "source".padStart(8), "restored".padStart(10), "status");
console.log("-".repeat(62));

for (const row of rows) {
  console.log(row.table.padEnd(30), row.sourceCount.padStart(8), row.restoredCount.padStart(10), row.ok ? "ok" : "MISMATCH");
}

console.log("-".repeat(62));
console.log(`migrations (applied|latest): source ${sourceMigrations} / restored ${restoredMigrations}`);

if (mismatches > 0) {
  cleanup();
  fail(`${mismatches} table(s) differ between source and restored database.`);
}

if (sourceMigrations !== restoredMigrations) {
  cleanup();
  fail("Prisma migration ledger differs between source and restored database.");
}

cleanup();
console.log("db:restore:verify: PASS — schema, tables, row counts, and migration ledger match.");