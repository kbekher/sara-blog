// PLACEHOLDER root layout for public site — owned by the public-site agent.
import { notFound } from "next/navigation";
import { locales, isLocale } from "@/lib/i18n/config";
import { sourceSerif } from "../fonts";
import { ThemeScript } from "@/components/theme-script";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={sourceSerif.variable} suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body>{children}</body>
    </html>
  );
}
