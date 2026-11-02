import { localeTags, type Locale } from "./config";
import ru, { type Dictionary, type PluralForms } from "./dictionaries/ru";
import uk from "./dictionaries/uk";
import en from "./dictionaries/en";

export type { Dictionary, PluralForms, LinkedText } from "./dictionaries/ru";

/**
 * UI dictionaries are small, plain objects, so they're imported statically (no async loading).
 * Safe to use from Server Components; Client Components should receive only the slice they need as props.
 */
const dictionaries: Record<Locale, Dictionary> = { ru, uk, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Fills `{key}` placeholders: fmt("Page {page}", { page: 2 }) → "Page 2". Unknown keys are left as-is. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

/** Picks the right plural form for `n` (Intl.PluralRules) and fills `{n}`. */
export function plural(locale: Locale, n: number, forms: PluralForms): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(localeTags[locale]);
    pluralRules.set(locale, rules);
  }
  const category = rules.select(n) as keyof PluralForms;
  const template = forms[category] ?? forms.other;
  return fmt(template, { n: new Intl.NumberFormat(localeTags[locale]).format(n) });
}

/** Long, human date in the locale: "2 ноября 2026 г." / "2 листопада 2026 р." / "November 2, 2026". */
export function formatDate(locale: Locale, date: Date | string): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(typeof date === "string" ? new Date(date) : date);
}
