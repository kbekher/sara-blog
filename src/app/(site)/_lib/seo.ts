import type { Metadata } from "next";
import { fmt, getDictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";

/** Site origin without a trailing slash. */
export const siteOrigin = site.url.replace(/\/+$/, "");

/** Absolute URL for a site-relative path ("/posts/x" → "https://…/posts/x"). */
export function absoluteUrl(path: string): string {
  return `${siteOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

export const RSS_PATH = "/rss.xml";

/**
 * Canonical URL + the RSS feed link for a page. The site has a single language (Russian), so there are no hreflang
 * alternates. Pages must spread this into `alternates` because metadata merging is shallow (a page's `alternates`
 * replaces the layout's entirely).
 */
export function pageAlternates(path = "/"): NonNullable<Metadata["alternates"]> {
  return {
    canonical: path,
    types: { "application/rss+xml": [{ url: RSS_PATH, title: fmt(getDictionary().meta.rssTitle, { site: site.name }) }] },
  };
}

/** Serializes JSON-LD safely for inline <script> (prevents `</script>` breakouts). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
