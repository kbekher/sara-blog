/**
 * Session JWT (HS256 via jose). Edge/Node safe — used by src/proxy.ts and by server code.
 *
 * Tokens carry a `pwv` (password version) claim derived from ADMIN_EMAIL + ADMIN_PASSWORD_HASH,
 * so changing the admin password or email instantly invalidates every existing session.
 */
import { SignJWT, jwtVerify } from "jose";
import { getSessionKey, SESSION_MAX_AGE_SECONDS } from "./config";

const ISSUER = "sara-blog";
const AUDIENCE = "sara-blog:admin";

export type SessionPayload = {
  sub: "admin";
  email: string;
  /** issued-at, seconds */
  iat: number;
  /** expiry, seconds */
  exp: number;
};

async function passwordVersion(): Promise<string> {
  const material = `${process.env.ADMIN_EMAIL ?? ""}\n${process.env.ADMIN_PASSWORD_HASH ?? ""}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSessionToken(email: string): Promise<string> {
  const key = getSessionKey();
  if (!key) throw new Error("SESSION_SECRET is missing or shorter than 32 characters.");
  return new SignJWT({ email, pwv: await passwordVersion() })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("admin")
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key);
}

/** Returns the payload of a valid, unexpired admin token, or null. Never throws. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const key = getSessionKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: "admin",
    });
    if (typeof payload.email !== "string" || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.pwv !== (await passwordVersion())) return null;
    return { sub: "admin", email: payload.email, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}
