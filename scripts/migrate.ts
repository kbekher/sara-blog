/**
 * Applies pending Drizzle migrations (drizzle/*.sql) — used by `npm run vercel-build`.
 *
 * Without DATABASE_URL: fails the build on Vercel production (a production deploy without a database is
 * a misconfiguration), but only warns elsewhere (local builds, previews without a DB) so `next build` can run.
 */
import "./load-env";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

if (!process.env.DATABASE_URL) {
  if (process.env.VERCEL_ENV === "production") {
    console.error("✖ DATABASE_URL is not set — connect a Neon database (Vercel → Storage) before deploying.");
    process.exit(1);
  }
  console.warn("⚠ DATABASE_URL is not set — skipping database migrations.");
  process.exit(0);
}

const bin = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
const result = spawnSync(bin, ["migrate"], { stdio: "inherit", env: process.env });
if (result.status !== 0) {
  console.error("✖ Database migration failed.");
  process.exit(result.status ?? 1);
}
console.log("✔ Database is up to date.");
