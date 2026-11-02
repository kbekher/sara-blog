import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
/** Valid bcrypt hash of a random string; compared against when config is missing to keep timing uniform. */
const DUMMY_HASH = "$2b$12$bVHkI/Ooq5scz574FBf0xuit.R7vL1SXVShkikbTjffLJPbiZcU..";

/**
 * Reads ADMIN_PASSWORD_HASH. Two formats are accepted:
 *  - a raw bcrypt hash: `$2b$12$...` (must be quoted / `$`-escaped in .env files, see README)
 *  - `b64:<base64 of the bcrypt hash>` — immune to `$` variable expansion in .env files & dashboards
 */
export function getAdminPasswordHash(): string | null {
  const raw = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!raw) return null;
  const hash = raw.startsWith("b64:")
    ? Buffer.from(raw.slice(4), "base64").toString("utf8").trim()
    : raw.replace(/\\\$/g, "$"); // tolerate `\$`-escaped hashes when read by loaders that don't unescape
  if (!BCRYPT_PATTERN.test(hash)) {
    console.error(
      "[auth] ADMIN_PASSWORD_HASH is not a valid bcrypt hash. If it contains `$`, your .env loader may have " +
        "expanded it — use the `b64:` form printed by `npm run hash-password`.",
    );
    return null;
  }
  return hash;
}

export function getAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email ? email : null;
}

export function isAuthConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return Boolean(getAdminEmail() && getAdminPasswordHash() && secret && secret.length >= 32);
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Constant-time credential check. Always performs exactly one bcrypt comparison, whether or not the
 * email matches or the config is present, so response timing doesn't reveal which part was wrong.
 */
export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const expectedEmail = getAdminEmail();
  const hash = getAdminPasswordHash();
  const emailOk = timingSafeEqual(digest(email.trim().toLowerCase()), digest(expectedEmail ?? "\u0000"));
  const passwordOk = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(expectedEmail && hash) && emailOk && passwordOk;
}
