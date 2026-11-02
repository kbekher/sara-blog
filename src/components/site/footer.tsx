import Link from "next/link";
import { cacheLife } from "next/cache";
import { Rss } from "lucide-react";
import { localeNames, locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { NewsletterForm } from "./newsletter-form";

/**
 * The current year must not be read at request time outside a cache (Cache Components treats `new Date()`
 * as request data), so it is cached for a day — the copyright notice updates within 24h of New Year.
 */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="mt-24 border-t border-border bg-bg-sunken sm:mt-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1fr_minmax(0,28rem)] md:gap-16 md:py-20">
        <div className="flex flex-col gap-6">
          <div>
            <Link href={`/${locale}`} className="font-serif text-2xl font-semibold text-fg-strong">
              {site.name[locale]}
            </Link>
            <p className="mt-3 max-w-[40ch] text-[0.9375rem] text-fg-muted text-pretty">{site.description[locale]}</p>
          </div>

          <nav aria-label={dict.a11y.footerNav} className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link href={`/${locale}/tags`} className="text-fg-muted transition-colors hover:text-fg-strong">
              {dict.nav.tags}
            </Link>
            <Link href={`/${locale}/search`} className="text-fg-muted transition-colors hover:text-fg-strong">
              {dict.nav.search}
            </Link>
            <a
              href={`/${locale}/rss.xml`}
              className="inline-flex items-center gap-1.5 text-fg-muted transition-colors hover:text-fg-strong"
            >
              <Rss aria-hidden className="size-3.5" />
              {dict.footer.rss}
            </a>
          </nav>

          <div>
            <h2 className="text-xs font-medium tracking-[0.14em] text-fg-subtle uppercase">{dict.footer.languages}</h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {locales.map((l) => (
                <li key={l}>
                  <Link
                    href={`/${l}`}
                    hrefLang={l}
                    lang={l}
                    aria-current={l === locale ? "true" : undefined}
                    className={
                      l === locale ? "text-fg-strong" : "text-fg-muted transition-colors hover:text-fg-strong"
                    }
                  >
                    {localeNames[l]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-auto text-sm text-fg-subtle">
            © <CopyrightYear /> {site.author[locale]}. {dict.footer.rights}
          </p>
        </div>

        {/* The site's single newsletter signup (post pages don't repeat it), so it gets a faint accent glow. */}
        <NewsletterForm
          locale={locale}
          labels={dict.newsletter}
          className="self-start bg-[radial-gradient(110%_100%_at_100%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_70%)]"
        />
      </div>
    </footer>
  );
}
