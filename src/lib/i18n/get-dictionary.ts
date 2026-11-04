import { siteLocaleTag } from "./config";
import { site } from "@/lib/site";
import ru, { type Dictionary, type PluralForms } from "./dictionaries/ru";

export type { Dictionary, PluralForms } from "./dictionaries/ru";

/**
 * The UI dictionary (Russian only — readers use browser translation for other languages). A small, plain object,
 * imported statically. Safe to use from Server Components; Client Components should receive only the slice they need.
 */
export function getDictionary(): Dictionary {
  return ru;
}

/** Fills `{key}` placeholders: fmt("Страница {page}", { page: 2 }) → "Страница 2". Unknown keys are left as-is. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

const pluralRules = new Intl.PluralRules(siteLocaleTag);
const numberFormat = new Intl.NumberFormat(siteLocaleTag);

/** Picks the right plural form for `n` (Intl.PluralRules) and fills `{n}`. */
export function plural(n: number, forms: PluralForms): string {
  const category = pluralRules.select(n) as keyof PluralForms;
  const template = forms[category] ?? forms.other;
  return fmt(template, { n: numberFormat.format(n) });
}

const dateFormat = new Intl.DateTimeFormat(siteLocaleTag, {
  day: "numeric",
  month: "long",
  year: "numeric",
  // Fixed site time zone keeps server rendering deterministic and dates correct for readers.
  timeZone: site.timeZone,
});

/** Long, human date: "2 ноября 2026 г.". */
export function formatDate(date: Date | string): string {
  return dateFormat.format(typeof date === "string" ? new Date(date) : date);
}

const monthFormat = new Intl.DateTimeFormat(siteLocaleTag, { month: "long", year: "numeric", timeZone: site.timeZone });
const numericMonthFormat = new Intl.DateTimeFormat(siteLocaleTag, {
  month: "2-digit",
  year: "numeric",
  timeZone: site.timeZone,
});

/** Month and year for labels: "ноябрь 2026" (no "г." suffix; labels are uppercased in CSS). */
export function formatMonthYear(date: Date | string): string {
  const parts = monthFormat.formatToParts(typeof date === "string" ? new Date(date) : date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${month} ${year}`.trim();
}

/** Compact numeric date for vertical card labels: "2026 · 11". */
export function formatYearMonth(date: Date | string): string {
  const parts = numericMonthFormat.formatToParts(typeof date === "string" ? new Date(date) : date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${year} · ${month}`;
}
