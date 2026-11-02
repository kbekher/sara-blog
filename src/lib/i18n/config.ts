export const locales = ["ru", "uk", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";
/** Language posts are authored in by default. */
export const sourceLocale: Locale = "ru";

export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  uk: "Українська",
  en: "English",
};
export const localeShort: Record<Locale, string> = { ru: "RU", uk: "UA", en: "EN" };
/** BCP-47 tags for <html lang>, hreflang and Intl formatting. */
export const localeTags: Record<Locale, string> = { ru: "ru-RU", uk: "uk-UA", en: "en-US" };
/** Microsoft Translator language codes. */
export const translatorCodes: Record<Locale, string> = { ru: "ru", uk: "uk", en: "en" };
/** LanguageTool language codes. */
export const languageToolCodes: Record<Locale, string> = { ru: "ru-RU", uk: "uk-UA", en: "en-US" };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
