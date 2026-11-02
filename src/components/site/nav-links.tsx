"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import clsx from "clsx";
import type { Locale } from "@/lib/i18n/config";

export type NavLabels = { home: string; tags: string; search: string };

type Item = { key: keyof NavLabels; href: string; match: (rest: string) => boolean };

function items(locale: Locale): Item[] {
  return [
    { key: "home", href: `/${locale}`, match: (rest) => rest === "" || rest.startsWith("/posts") },
    { key: "tags", href: `/${locale}/tags`, match: (rest) => rest.startsWith("/tags") },
    { key: "search", href: `/${locale}/search`, match: (rest) => rest.startsWith("/search") },
  ];
}

/** Path after the locale prefix: "/ru/tags/x" → "/tags/x". */
export function stripLocale(pathname: string | null): string | null {
  if (pathname === null) return null;
  const rest = pathname.replace(/^\/[^/]+/, "");
  return rest === "/" ? "" : rest;
}

/**
 * Presentational nav. `pathname` is null when rendered as the prerender fallback
 * (usePathname suspends on routes with unknown params), in which case nothing is marked current.
 */
export function NavLinksView({
  locale,
  labels,
  pathname,
  layout = "row",
  onNavigate,
}: {
  locale: Locale;
  labels: NavLabels;
  pathname: string | null;
  layout?: "row" | "column";
  onNavigate?: () => void;
}) {
  const rest = stripLocale(pathname);
  return (
    <ul className={clsx("flex", layout === "row" ? "items-center gap-1" : "flex-col gap-1")}>
      {items(locale).map((item) => {
        const current = rest !== null && item.match(rest);
        const isSearch = item.key === "search";
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              aria-label={isSearch && layout === "row" ? labels.search : undefined}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full text-[0.9375rem] transition-colors duration-300 ease-apple",
                layout === "row" ? (isSearch ? "size-9 justify-center" : "h-9 px-3.5") : "h-11 w-full px-4 text-base",
                current ? "text-fg-strong" : "text-fg-muted hover:text-fg-strong",
                "hover:bg-surface-hover",
                current && "bg-surface",
              )}
            >
              {isSearch && <Search aria-hidden className="size-[18px]" strokeWidth={1.75} />}
              {(!isSearch || layout === "column") && labels[item.key]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NavLinks(props: Omit<Parameters<typeof NavLinksView>[0], "pathname">) {
  const pathname = usePathname();
  return <NavLinksView {...props} pathname={pathname} />;
}
