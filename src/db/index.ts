import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

// Local development/testing only: point the HTTP driver at a local Neon-compatible endpoint
// (e.g. local-neon-http-proxy). Never set this in production.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

/**
 * Drizzle client over Neon's HTTP driver (ideal for Vercel serverless).
 * Throws lazily so builds without DATABASE_URL still succeed for pages that don't hit the DB.
 */
function createDb() {
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return drizzle(neon(url), { schema });
}

let _db: ReturnType<typeof createDb> | undefined;
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_t, prop) {
    _db ??= createDb();
    return Reflect.get(_db, prop, _db);
  },
});

export const hasDatabase = Boolean(url);
export { schema };
