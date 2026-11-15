import { config as loadEnv } from "dotenv";

/**
 * Vitest global setup.
 *
 * Integration tests need the same local database the application uses, and
 * Prisma/Next.js do not load `.env.local` automatically outside the CLI.
 * Loading it here keeps `DATABASE_URL` identical to the application's.
 */
loadEnv({ path: ".env.local", quiet: true });
