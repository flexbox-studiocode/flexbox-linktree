/**
 * CLI bootstrap for Phase 4 administrative commands.
 *
 * The CLI modules import the same server-only services the application uses, so
 * they are loaded in a plain Node process (started with `tsx`) through this
 * shim. It:
 *
 *   1. replaces the `server-only` marker (which throws outside a React Server
 *      Component environment) with an empty module, and
 *   2. resolves the `@/…` TypeScript path alias exactly like the application.
 *
 * Both are registered before the target module is imported.
 *
 * Usage (see package.json):
 *   tsx --env-file=.env.local src/features/auth/cli/run.ts bootstrap.ts
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

/** Resolves an extensionless path the way the TypeScript bundler would. */
function tryResolveWithExtensions(absolutePath: string): string | null {
  const candidates = [
    absolutePath,
    `${absolutePath}.ts`,
    `${absolutePath}.tsx`,
    `${absolutePath}.mjs`,
    `${absolutePath}.js`,
    `${absolutePath}/index.ts`,
    `${absolutePath}/index.tsx`,
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return {
        url: new URL("./server-only-stub.mjs", import.meta.url).href,
        shortCircuit: true,
      };
    }

    if (specifier.startsWith("@/")) {
      const absolutePath = `${repositoryRoot}src/${specifier.slice(2)}`;
      const resolved = tryResolveWithExtensions(absolutePath);

      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});

const target = process.argv[2];

if (!target) {
  console.error("Usage: tsx src/features/auth/cli/run.ts <cli-module.ts>");
  process.exit(1);
}

// Imported dynamically so this shim has no top-level `await`, which keeps it
// compatible with the CommonJS transform `tsx` applies to `.ts` entry files.
void import(new URL(target, import.meta.url).href);
