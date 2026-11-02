import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOGIN_PATH, SESSION_COOKIE, sessionCookieOptions } from "./config";
import { signSessionToken, verifySessionToken, type SessionPayload } from "./jwt";

export type { SessionPayload };

/** Sets the signed session cookie. Call only from a Server Action or Route Handler. */
export async function createSession(email: string): Promise<void> {
  const token = await signSessionToken(email);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function deleteSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
}

/** The verified admin session for this request, or null. Deduplicated per request. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

export async function isAdmin(): Promise<boolean> {
  return (await getSession()) !== null;
}

/**
 * For Server Components / pages: returns the session or redirects to the login page.
 * (Server Actions should prefer `getSession()` and return a friendly error so unsaved
 * editor content isn't lost by a redirect.)
 */
export async function requireAdmin(next?: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect(next ? `${LOGIN_PATH}?next=${encodeURIComponent(next)}` : LOGIN_PATH);
  }
  return session;
}
