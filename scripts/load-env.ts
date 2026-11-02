/**
 * Loads .env* files exactly like Next.js does (.env.local, .env.development, .env …).
 * Import this FIRST in every script, before anything that reads process.env at module load.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
