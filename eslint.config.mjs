import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma Client. Regenerate with `pnpm db:generate`.
    "src/generated/**",
    // Tooling and local-only output.
    "coverage/**",
    "storage/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;