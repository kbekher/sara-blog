"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import clsx from "clsx";
import { localeNames, localeShort, locales, type Locale } from "@/lib/i18n/config";
import { stripLocale } from "./nav-links";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Remembers the choice for src/proxy.ts (which redirects "/" based on NEXT_LOCALE / Accept-Language). */
function rememberLocale(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export type LanguageToggleLabels = { label: string; switchTo: string };

/**
 * RU / UA / EN segmented control. Keeps the current path (/ru/posts/x → /en/posts/x) and query string.
 * `pathname` is null in the prerender fallback; links then point at each locale's home page.
 */
export function LanguageToggleView({
  locale,
  labels,
  pathname,
  className,
}: {
  locale: Locale;
  labels: LanguageToggleLabels;
  pathname: string | null;
  className?: string;
}) {
  const router = useRouter();
  const rest = stripLocale(pathname) ?? "";

  function onClick(event: MouseEvent<HTMLAnchorElement>, target: Locale, href: string) {
    rememberLocale(target);
    // Preserve ?q= etc. (read at click time so this component never needs useSearchParams/Suspense).
    const search = window.location.search;
    if (search && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
      event.preventDefault();
      router.push(`${href}${search}`);
    }
  }

  return (
    <nav aria-label={labels.label} className={className}>
      <ul className="relative flex items-center rounded-full border border-border bg-surface p-0.5">
        {locales.map((l) => {
          const active = l === locale;
          const href = `/${l}${rest}`;
          return (
            <li key={l}>
              <Link
                href={href}
                hrefLang={l}
                lang={l}
                scroll={false}
                aria-current={active ? "true" : undefined}
                aria-label={labels.switchTo.replace("{language}", localeNames[l])}
                title={localeNames[l]}
                onClick={(e) => onClick(e, l, href)}
                className={clsx(
                  "inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2 text-xs font-medium tracking-wide",
                  "transition-[background-color,color,box-shadow] duration-300 ease-apple",
                  active
                    ? "bg-bg-elevated text-fg-strong shadow-[0_1px_2px_rgb(0_0_0/0.2),inset_0_0_0_1px_var(--border)]"
                    : "text-fg-muted hover:text-fg-strong",
                )}
              >
                {localeShort[l]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function LanguageToggle(props: Omit<Parameters<typeof LanguageToggleView>[0], "pathname">) {
  const pathname = usePathname();
  return <LanguageToggleView {...props} pathname={pathname} />;
}
