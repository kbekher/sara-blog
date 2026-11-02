import type { Metadata } from "next";
import { siteLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { ThemeScript } from "@/components/theme-script";
import { TranslateGuard } from "@/components/translate-guard";
import { NotFoundContent } from "@/components/site/not-found-content";
import { sourceSerif } from "./fonts";
import "./globals.css";

/**
 * 404 for URLs that match no route at all. The app has two root layouts — `(site)` and `admin` — and no top-level
 * `app/layout.tsx`, so this page renders its own <html> (Next.js `experimental.globalNotFound`).
 */
export const metadata: Metadata = {
  title: `${getDictionary().notFound.title} — ${site.name}`,
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang={siteLocale} className={sourceSerif.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <TranslateGuard />
      </head>
      <body className="flex min-h-dvh flex-col">
        <main className="flex-1">
          <NotFoundContent />
        </main>
      </body>
    </html>
  );
}
