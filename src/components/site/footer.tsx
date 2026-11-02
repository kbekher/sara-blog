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

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="mt-24 border-t border-border bg-bg-sunken sm:mt-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1fr_minmax(0,28rem)] md:gap-16 md:py-20">
        <div className="flex flex-col gap-6">
          <div>
            <Link href="/" className="font-serif text-2xl font-semibold text-fg-strong">
              {site.name}
            </Link>
            <p className="mt-3 max-w-[40ch] text-[0.9375rem] text-fg-muted text-pretty">{site.description}</p>
          </div>

          <nav aria-label={dict.a11y.footerNav} className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link href="/tags" className="text-fg-muted transition-colors hover:text-fg-strong">
              {dict.nav.tags}
            </Link>
            <Link href="/search" className="text-fg-muted transition-colors hover:text-fg-strong">
              {dict.nav.search}
            </Link>
            <a
              href="/rss.xml"
              className="inline-flex items-center gap-1.5 text-fg-muted transition-colors hover:text-fg-strong"
            >
              <Rss aria-hidden className="size-3.5" />
              <span>{dict.footer.rss}</span>
            </a>
          </nav>

          <p className="mt-auto text-sm text-fg-subtle">
            © <CopyrightYear /> {site.author}. {dict.footer.rights}
          </p>
        </div>

        {/* The site's single newsletter signup (post pages don't repeat it), so it gets a faint accent glow. */}
        <NewsletterForm
          labels={dict.newsletter}
          className="self-start bg-[radial-gradient(110%_100%_at_100%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_70%)]"
        />
      </div>
    </footer>
  );
}
