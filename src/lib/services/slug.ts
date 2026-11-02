/**
 * URL slugs: Cyrillic (Russian / Ukrainian) → Latin transliteration, kebab-case.
 * Pure & isomorphic (no server-only imports) so the editor can preview slugs client-side.
 *
 * Russian follows the common "Yandex/GOST-lite" web scheme (х → kh, щ → shch, й → y);
 * Ukrainian follows the official 2010 national transliteration (г → h, и → y, і → i, ї → yi, є → ye).
 */
import type { Locale } from "@/lib/i18n/config";

/** Max slug length; long titles are cut at a word boundary. */
export const SLUG_MAX_LENGTH = 80;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const COMMON: Record<string, string> = {
  а: "a", б: "b", в: "v", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ь: "", ю: "yu", я: "ya",
  // Ukrainian / Belarusian letters that may appear in any text
  і: "i", ї: "yi", є: "ye", ґ: "g", ў: "u",
};

const RUSSIAN: Record<string, string> = { ...COMMON, г: "g", и: "i", ы: "y", э: "e" };
const UKRAINIAN: Record<string, string> = { ...COMMON, г: "h", и: "y", ы: "y", э: "e" };

/** Apostrophes are dropped (Ukrainian "м'ята" → "myata"), not turned into dashes. */
const APOSTROPHES = /['’ʼ`´]/g;

export function transliterate(input: string, locale: Locale = "ru"): string {
  const table = locale === "uk" ? UKRAINIAN : RUSSIAN;
  let out = "";
  for (const ch of input.replace(APOSTROPHES, "")) {
    const lower = ch.toLowerCase();
    const mapped = table[lower];
    out += mapped ?? lower;
  }
  return out;
}

/**
 * "Привет, мир!" → "privet-mir"; "Café über alles" → "cafe-uber-alles".
 * Returns "" when nothing slug-worthy remains (e.g. emoji-only titles) — callers provide a fallback.
 */
export function slugify(input: string, locale: Locale = "ru", maxLength = SLUG_MAX_LENGTH): string {
  const slug = transliterate(input.trim(), locale)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength + 1);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > maxLength / 2 ? cut.slice(0, lastDash) : slug.slice(0, maxLength)).replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX_LENGTH + 8 && SLUG_PATTERN.test(slug);
}

/**
 * Picks `base`, or `base-2`, `base-3`, … — the first candidate not in `taken`.
 * `taken` should contain all existing slugs equal to `base` or starting with `base-`.
 */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!set.has(candidate)) return candidate;
  }
}
