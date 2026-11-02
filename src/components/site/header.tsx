import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n/config";
import { fmt, type Dictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderFrame } from "./header-frame";
import { NavLinks, NavLinksView } from "./nav-links";
import { LanguageToggle, LanguageToggleView } from "./language-toggle";
import { MobileMenu } from "./mobile-menu";

/**
 * Pathname-aware pieces (active nav item, language links that keep the path) call usePathname(), which
 * suspends while prerendering routes with unknown params — so each sits in Suspense with a path-less fallback.
 */
export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const navLabels = dict.nav;
  const langLabels = dict.language;
  const themeLabels = dict.theme;

  const nav = (layout: "row" | "column") => (
    <Suspense fallback={<NavLinksView locale={locale} labels={navLabels} pathname={null} layout={layout} />}>
      <NavLinks locale={locale} labels={navLabels} layout={layout} />
    </Suspense>
  );
  const languages = (
    <Suspense fallback={<LanguageToggleView locale={locale} labels={langLabels} pathname={null} />}>
      <LanguageToggle locale={locale} labels={langLabels} />
    </Suspense>
  );

  return (
    <HeaderFrame>
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href={`/${locale}`}
          aria-label={fmt(dict.a11y.home, { site: site.name })}
          className="font-serif text-[1.3125rem] font-semibold tracking-[-0.01em] text-fg-strong transition-opacity duration-300 ease-apple hover:opacity-80"
        >
          {site.name}
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <nav aria-label={dict.a11y.mainNav}>{nav("row")}</nav>
          <span aria-hidden className="h-5 w-px bg-border" />
          {languages}
          <ThemeToggle labels={themeLabels} />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle labels={themeLabels} />
          <MobileMenu labels={{ open: dict.a11y.openMenu, close: dict.a11y.closeMenu }}>
            <nav aria-label={dict.a11y.mainNav}>{nav("column")}</nav>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border px-1 pt-3">
              <span className="text-sm text-fg-muted">{langLabels.label}</span>
              {languages}
            </div>
          </MobileMenu>
        </div>
      </div>
    </HeaderFrame>
  );
}
