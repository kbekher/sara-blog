import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";
import { site } from "@/lib/site";

/** Site origin without a trailing slash. */
export const siteOrigin = site.url.replace(/\/+$/, "");

/** Absolute URL for a site-relative path ("/ru/posts/x" → "https://…/ru/posts/x"). */
export function absoluteUrl(path: string): string {
  return `${siteOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Locale-prefixed path: localePath("en", "/posts/x") → "/en/posts/x"; localePath("en") → "/en". */
export function localePath(locale: Locale, path = ""): string {
  const rest = path === "/" ? "" : path;
  return `/${locale}${rest && !rest.startsWith("/") ? `/${rest}` : rest}`;
}

export function rssPath(locale: Locale): string {
  return `/${locale}/rss.xml`;
}

/**
 * Canonical + hreflang alternates (ru/uk/en + x-default → ru) + the locale's RSS feed for a page.
 * `path` is locale-less ("" for home, "/posts/slug", …). Pages must spread this into `alternates`
 * because metadata merging is shallow (a page's `alternates` replaces the layout's entirely).
 */
export function pageAlternates(locale: Locale, path = ""): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = localePath(l, path);
  languages["x-default"] = localePath(defaultLocale, path);
  return {
    canonical: localePath(locale, path),
    languages,
    types: { "application/rss+xml": rssPath(locale) },
  };
}

/** Serializes JSON-LD safely for inline <script> (prevents `</script>` breakouts). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
