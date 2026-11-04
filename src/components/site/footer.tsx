import Link from "next/link";
import { cacheLife } from "next/cache";
import { Rss } from "lucide-react";
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

/**
 * Minimal footer: brand, small links, copyright, one hairline. The newsletter strip sits above it on every page
 * except the home page, which shows its own strip (marked [data-home-newsletter]; hidden here via CSS :has()).
 */
export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="mt-24 sm:mt-32">
      <div className="mx-auto max-w-[75rem] px-5 sm:px-8 lg:px-12">
        <div className="footer-newsletter mb-16 sm:mb-20">
          <NewsletterForm labels={dict.newsletter} variant="strip" />
        </div>
        <div className="flex flex-col gap-5 border-t border-border pt-7 pb-10 text-[0.8125rem] text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="brand-wordmark text-[0.9375rem] text-fg-strong">
              {site.name}
            </Link>
            <nav aria-label={dict.a11y.footerNav}>
              <ul className="flex flex-wrap items-center gap-x-1">
                <li>
                  <Link href="/tags" className="inline-flex min-h-11 items-center px-2 transition-colors hover:text-fg-strong sm:min-h-8">
                    {dict.nav.tags}
                  </Link>
                </li>
                <li>
                  <Link href="/search" className="inline-flex min-h-11 items-center px-2 transition-colors hover:text-fg-strong sm:min-h-8">
                    {dict.nav.search}
                  </Link>
                </li>
                <li>
                  <a
                    href="/rss.xml"
                    className="inline-flex min-h-11 items-center gap-1.5 px-2 transition-colors hover:text-fg-strong sm:min-h-8"
                  >
                    <Rss aria-hidden className="size-3.5" />
                    <span>{dict.footer.rss}</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <p>
            © <CopyrightYear /> {site.author}. {dict.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
