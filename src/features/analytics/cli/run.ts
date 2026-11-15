/**
 * CLI bootstrap for analytics maintenance.
 *
 * Mirrors `src/features/auth/cli/run.ts`: it swaps the `server-only` marker for
 * an empty module and resolves the `@/...` alias, then loads the target module in
 * a plain Node process started with `tsx`. Keep the two shims aligned if the
 * alias convention changes.
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

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
  console.error("Usage: tsx src/features/analytics/cli/run.ts <cli-module.ts>");
  process.exit(1);
}

void import(new URL(target, import.meta.url).href);