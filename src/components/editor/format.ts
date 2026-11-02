/** Small shared helpers for editor UI (Russian labels, URL normalization). */
import { TEXT_COLORS, type TextColor } from "@/lib/content/types";
import { isAllowedHref } from "@/lib/content/extensions";

export const COLOR_LABELS: Record<TextColor, string> = {
  gray: "Серый",
  red: "Красный",
  orange: "Оранжевый",
  yellow: "Жёлтый",
  green: "Зелёный",
  blue: "Синий",
  purple: "Фиолетовый",
  pink: "Розовый",
};

export { TEXT_COLORS };

/**
 * Turn what a person typed into a safe href, or null if it can't be a link.
 *  "example.com/x" → "https://example.com/x", "me@mail.ru" → "mailto:me@mail.ru", "/ru/posts/x" stays.
 */
export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(value)) return `mailto:${value}`;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  let candidate = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // Looks like a domain? (has a dot, no spaces)
    if (!/^[^\s/]+\.[^\s/]{2,}/.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol === "mailto:") return isAllowedHref(candidate) ? candidate : null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return isAllowedHref(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** "⌘B" on Mac, "Ctrl+B" elsewhere — for tooltips. */
export function shortcut(keys: string): string {
  return isMac() ? keys.replace(/Mod\+?/g, "⌘").replace(/Shift\+?/g, "⇧").replace(/Alt\+?/g, "⌥") : keys.replace(/Mod/g, "Ctrl");
}
