import type { Metadata, Viewport } from "next";
import { siteLocale, siteLocaleTag } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { ThemeScript } from "@/components/theme-script";
import { TranslateGuard } from "@/components/translate-guard";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { sourceSerif } from "../fonts";
import { pageAlternates, siteOrigin } from "./_lib/seo";
import "../globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
  ],
  colorScheme: "dark light",
};

const dict = getDictionary();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: { default: `${site.name} — ${dict.meta.homeTitle}`, template: `%s — ${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.author }],
  creator: site.author,
  alternates: pageAlternates(),
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: siteLocaleTag.replace("-", "_"),
    title: site.name,
    description: site.description,
  },
  twitter: { card: "summary_large_image", title: site.name, description: site.description },
  formatDetection: { telephone: false, email: false, address: false },
};

/**
 * Root layout of the public site (the admin has its own root layout). Russian only: readers who want another
 * language use the browser's built-in translation, so nothing here opts out of translation.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={siteLocale} className={sourceSerif.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <TranslateGuard />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-16 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-transform duration-300 ease-apple focus-visible:translate-y-0"
        >
          <span>{dict.a11y.skipToContent}</span>
        </a>
        <SiteHeader dict={dict} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter dict={dict} />
      </body>
    </html>
  );
}
