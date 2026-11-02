/**
 * Proxy (formerly "middleware") — runs before routes render (Node.js runtime by default).
 *
 *  1. /admin/**   → auth gate: no valid session ⇒ redirect to /admin/login?next=…;
 *                   valid session on /admin/login ⇒ redirect to /admin. Rolling cookie refresh.
 *                   (Every Server Action / Route Handler re-verifies the session itself.)
 *  2. public URLs without a locale prefix (/, /posts/x) ⇒ 307 to /<locale>/…,
 *     locale = NEXT_LOCALE cookie → Accept-Language best match → "ru".
 */
import { NextResponse, type NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { defaultLocale, isLocale, locales, type Locale } from "@/lib/i18n/config";
import {
  ADMIN_HOME,
  LOGIN_PATH,
  safeAdminRedirect,
  SESSION_COOKIE,
  SESSION_REFRESH_AFTER_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/config";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

const LOCALE_COOKIE = "NEXT_LOCALE";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`)) {
    return handleAdmin(request);
  }

  // Root-level metadata routes generated without a file extension (app/icon.tsx → /icon, /apple-icon).
  if (/^\/(?:apple-)?icon\d*(?:\/|$)/.test(pathname)) return NextResponse.next();

  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 307);
}

async function handleAdmin(request: NextRequest) {
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

function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) return defaultLocale;
  try {
    const languages = new Negotiator({ headers: { "accept-language": acceptLanguage } })
      .languages()
      .filter((l) => l !== "*");
    if (languages.length === 0) return defaultLocale;
    const matched = match(languages, locales as unknown as string[], defaultLocale);
    return isLocale(matched) ? matched : defaultLocale;
  } catch {
    // Malformed Accept-Language tags make Intl throw — fall back silently.
    return defaultLocale;
  }
}

export const config = {
  // Everything except Next internals, API routes, Vercel internals and files with an extension
  // (favicon.ico, robots.txt, sitemap.xml, manifest.webmanifest, images, …).
  matcher: ["/((?!api/|api$|_next/|_vercel/|.*\\..*).*)"],
};
