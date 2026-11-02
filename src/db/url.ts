/**
 * Resolves the Postgres connection string.
 *
 * The Neon ↔ Vercel integration names its variables differently depending on how it was connected
 * (e.g. a "Custom Prefix" turns DATABASE_URL into STORAGE_URL / <PREFIX>_DATABASE_URL), so we accept
 * the common names in order of preference. No `server-only` import: also used by scripts & drizzle.config.
 */
const CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "STORAGE_DATABASE_URL",
  "STORAGE_URL",
  "STORAGE_POSTGRES_URL",
  "NEON_DATABASE_URL",
] as const;

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  for (const name of CANDIDATES) {
    const value = env[name]?.trim();
    if (value && /^postgres(ql)?:\/\//i.test(value)) return value;
  }
  // Any other "<PREFIX>_DATABASE_URL" holding a postgres URL (custom integration prefix).
  for (const [name, value] of Object.entries(env)) {
    if (/_DATABASE_URL$/.test(name) && !/UNPOOLED/.test(name) && value && /^postgres(ql)?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }
  return undefined;
}

/** Names (never values) of env vars that look database-related — for diagnostics. */
export function databaseEnvNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env)
    .filter((k) => /DATABASE|POSTGRES|^PG|NEON|STORAGE/i.test(k))
    .sort();
}
