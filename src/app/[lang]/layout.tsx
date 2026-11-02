import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales, localeTags } from "@/lib/i18n/config";
import { fmt, getDictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { ThemeScript } from "@/components/theme-script";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { sourceSerif } from "../fonts";
import { pageAlternates, siteOrigin } from "./_lib/seo";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
  ],
  colorScheme: "dark light",
};

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  const description = site.description[lang];
  return {
    metadataBase: new URL(siteOrigin),
    title: { default: `${site.name} — ${dict.meta.homeTitle}`, template: `%s — ${site.name}` },
    description,
    applicationName: site.name,
    authors: [{ name: site.author }],
    creator: site.author,
    alternates: {
      ...pageAlternates(lang),
      types: { "application/rss+xml": [{ url: `/${lang}/rss.xml`, title: fmt(dict.meta.rssTitle, { site: site.name }) }] },
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: localeTags[lang].replace("-", "_"),
      alternateLocale: locales.filter((l) => l !== lang).map((l) => localeTags[l].replace("-", "_")),
      title: site.name,
      description,
    },
    twitter: { card: "summary_large_image", title: site.name, description },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html lang={lang} className={sourceSerif.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-16 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-transform duration-300 ease-apple focus-visible:translate-y-0"
        >
          {dict.a11y.skipToContent}
        </a>
        <SiteHeader locale={lang} dict={dict} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter locale={lang} dict={dict} />
      </body>
    </html>
  );
}
