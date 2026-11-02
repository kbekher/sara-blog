/**
 * Applies pending Drizzle migrations (drizzle/*.sql) — used by `npm run vercel-build`.
 *
 * Uses drizzle-orm's Neon HTTP migrator (same driver as the app), so no extra Postgres driver
 * (pg / postgres / ws) is needed at build time.
 *
 * Without DATABASE_URL: fails the build on Vercel production (a production deploy without a database is
 * a misconfiguration), but only warns elsewhere (local builds, previews without a DB) so `next build` can run.
 */
import "./load-env";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("✖ DATABASE_URL is not set — connect a Neon database (Vercel → Storage) and redeploy.");
      process.exit(1);
    }
    console.warn("⚠ DATABASE_URL is not set — skipping database migrations.");
    return;
  }
  // Local testing only (see src/db/index.ts).
  if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

  await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
  console.log("✔ Database is up to date.");
}

main().catch((error) => {
  console.error("✖ Database migration failed:", error);
  process.exit(1);
});
