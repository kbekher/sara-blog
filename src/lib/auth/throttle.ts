import "server-only";
import { createHmac } from "node:crypto";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { db, hasDatabase } from "@/db";
import { loginAttempts } from "@/db/schema";

/** Max failed logins per IP within the window before further attempts are refused. */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * IPs are stored as a keyed hash (HMAC with SESSION_SECRET) — enough to count attempts,
 * without keeping raw visitor IPs in the database.
 */
function ipKey(ip: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "sara-blog").update(ip).digest("hex").slice(0, 32);
}

export async function isLoginThrottled(ip: string): Promise<boolean> {
  if (!hasDatabase) return false; // local dev without a database
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ipKey(ip)), gte(loginAttempts.createdAt, since)));
  return (row?.n ?? 0) >= MAX_FAILURES;
}

export async function recordLoginFailure(ip: string): Promise<void> {
  if (!hasDatabase) return;
  await db.batch([
    db.insert(loginAttempts).values({ ip: ipKey(ip) }),
    // Opportunistic cleanup keeps the table tiny.
    db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
  ]);
}

export async function clearLoginFailures(ip: string): Promise<void> {
  if (!hasDatabase) return;
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ipKey(ip)));
}
