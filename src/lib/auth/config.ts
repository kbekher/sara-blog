/**
 * Auth constants & key material. Edge/Node safe (no Node-only APIs), shared by proxy and server code.
 */
export const SESSION_COOKIE = "sara_session";
/** 30 days */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Rolling refresh: re-issue the cookie when the token is older than this. */
export const SESSION_REFRESH_AFTER_SECONDS = 60 * 60 * 24;

export const LOGIN_PATH = "/admin/login";
export const ADMIN_HOME = "/admin";

const encoder = new TextEncoder();

/** HMAC key for session JWTs, or null when SESSION_SECRET is missing/too short (auth then fails closed). */
export function getSessionKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return encoder.encode(secret);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/**
 * Validates a post-login redirect target: only same-origin admin paths (never the login page itself,
 * never protocol-relative "//evil.com" or backslash tricks). Falls back to /admin.
 */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (!next || typeof next !== "string" || next.length > 2048) return ADMIN_HOME;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return ADMIN_HOME;
  try {
    const base = "http://internal.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return ADMIN_HOME;
    const isAdmin = url.pathname === ADMIN_HOME || url.pathname.startsWith(`${ADMIN_HOME}/`);
    if (!isAdmin || url.pathname === LOGIN_PATH || url.pathname.startsWith(`${LOGIN_PATH}/`)) return ADMIN_HOME;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return ADMIN_HOME;
  }
}
