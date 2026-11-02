/**
 * The site is Russian-only: UI and posts are in Russian and every page is served with `<html lang="ru">`.
 * Readers who prefer Ukrainian, English, … use their browser's built-in page translation
 * (Chrome/Edge/Safari "Translate this page"), so there are no per-language URLs or translated copies.
 */
export const siteLocale = "ru";
/** BCP-47 tag for Intl formatting, og:locale, RSS `<language>` and JSON-LD `inLanguage`. */
export const siteLocaleTag = "ru-RU";

/**
 * Language codes of the database `locale` enum (`posts.source_locale`, `post_translations.locale`) and of the
 * pure text helpers (typography, transliteration, reading time). The schema is unchanged from the multilingual
 * days; posts are always written — and read — in `siteLocale`.
 */
export type Locale = "ru" | "uk" | "en";
