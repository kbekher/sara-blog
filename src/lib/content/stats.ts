/** Word count & reading time — dependency-free, safe for client and server. */
import type { Locale } from "@/lib/i18n/config";

/** Words per minute for comfortable reading; Cyrillic words are longer on average. */
export const READING_WPM: Record<Locale, number> = { ru: 180, uk: 180, en: 230 };
/** Extra seconds a reader spends on each image. */
const SECONDS_PER_IMAGE = 10;

export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

export function readingMinutesFor(plainText: string, locale: Locale = "ru", images = 0): number {
  const minutes = countWords(plainText) / READING_WPM[locale] + (images * SECONDS_PER_IMAGE) / 60;
  return Math.max(1, Math.round(minutes));
}
