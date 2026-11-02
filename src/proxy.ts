/**
 * Proxy (formerly "middleware") — runs before routes render (Node.js runtime by default).
 *
 * Only the admin auth gate lives here (the public site is Russian-only with plain URLs; old `/ru|/uk|/en/…`
 * links are permanently redirected in next.config.ts):
 *   /admin/** → no valid session ⇒ redirect to /admin/login?next=…;
 *               valid session on /admin/login ⇒ redirect to /admin. Rolling cookie refresh.
 *               (Every Server Action / Route Handler re-verifies the session itself.)
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_HOME,
  LOGIN_PATH,
  safeAdminRedirect,
  SESSION_COOKIE,
  SESSION_REFRESH_AFTER_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/config";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const isLogin = pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);

  if (isLogin) {
    if (session) {
      // safeAdminRedirect only ever returns a same-origin /admin path (possibly with a query string).
      return NextResponse.redirect(new URL(safeAdminRedirect(request.nextUrl.searchParams.get("next")), request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    // Server Action POSTs are let through: the action re-checks the session and returns a friendly
    // error instead of a redirect, so unsaved editor content isn't lost.
    if (request.method === "POST" && request.headers.has("next-action")) return NextResponse.next();

    const url = new URL(LOGIN_PATH, request.url);
    const next = `${pathname}${search}`;
    if (next !== ADMIN_HOME) url.searchParams.set("next", next);
    const response = NextResponse.redirect(url);
    if (token) response.cookies.delete(SESSION_COOKIE); // drop expired / invalid cookie
    return response;
  }

  const response = NextResponse.next();
  // Rolling session: re-issue a fresh 30-day token at most once a day.
  const now = Math.floor(Date.now() / 1000);
  if (now - session.iat > SESSION_REFRESH_AFTER_SECONDS) {
    try {
      response.cookies.set(SESSION_COOKIE, await signSessionToken(session.email), sessionCookieOptions);
    } catch {
      // Missing secret can't happen here (verification succeeded); ignore refresh failures.
    }
  }
  return response;
}

export const config = {
  // `:path*` also matches zero segments, so this covers /admin itself.
  matcher: ["/admin/:path*"],
};
