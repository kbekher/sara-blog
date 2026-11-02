import "server-only";

/**
 * Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform (client-supplied values are
 * overwritten), so its first entry is trustworthy there.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * CSRF guard for mutating Route Handlers: the `Origin` header must be present and match the host the
 * request was sent to. (Server Actions get the equivalent check from Next.js itself.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host.split(",")[0]!.trim();
  } catch {
    return false;
  }
}
