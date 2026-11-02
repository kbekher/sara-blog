import type { Locale } from "@/lib/i18n/config";

/** Central site settings — edit freely. */
export const site = {
  /** Blog name per locale (header, footer, titles, OG images, RSS, JSON-LD). */
  name: { ru: "Блог Сары", uk: "Блог Сари", en: "Sara's Blog" } satisfies Record<Locale, string>,
  /** Author name per locale (bylines, metadata, RSS, JSON-LD). */
  author: { ru: "Сара", uk: "Сара", en: "Sara" } satisfies Record<Locale, string>,
  /** IANA time zone used to display post dates (and the admin scheduler hint). */
  timeZone: process.env.NEXT_PUBLIC_SITE_TIMEZONE || "Europe/Kyiv",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description: {
    ru: "Мысли о разных сторонах жизни и очень необычный жизненный опыт.",
    uk: "Думки про різні сторони життя та дуже незвичайний життєвий досвід.",
    en: "Thoughts on different sides of life, and a very uncommon life experience.",
  },
} as const;

/** The blog name in the given locale. */
export function siteName(locale: Locale): string {
  return site.name[locale];
}

/** The author's name in the given locale. */
export function siteAuthor(locale: Locale): string {
  return site.author[locale];
}
