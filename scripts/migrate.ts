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
import { databaseEnvNames, getDatabaseUrl } from "../src/db/url";

async function main() {
  const url = getDatabaseUrl();
  if (!url) {
    if (process.env.VERCEL_ENV === "production") {
      const seen = databaseEnvNames();
      console.error("✖ DATABASE_URL is not set — connect a Neon database (Vercel → Storage) to the Production environment and redeploy.");
      console.error(
        seen.length
          ? `  Database-related variables visible to this build (names only): ${seen.join(", ")}`
          : "  No database-related environment variables are visible to this build.",
      );
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
