import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma does not load Next.js environment files automatically. Load the same
// file the application uses so CLI commands target the local development
// database. In CI/staging/production the variables are provided by the
// environment and dotenv leaves them untouched.
loadEnv({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL before running Prisma commands.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});