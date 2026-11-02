import "server-only";
import type { JSONContent } from "@tiptap/core";
import { htmlToJson, renderContent } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import { translateBatch } from "./deepl";

export type TranslatedPost = {
  locale: Locale;
  title: string;
  excerpt: string;
  contentJson: JSONContent;
  contentHtml: string;
  plainText: string;
  readingMinutes: number;
};

export type TranslationSource = {
  locale: Locale;
  title: string;
  excerpt: string;
  /** sanitized HTML of the source (post_translations.content_html) */
  contentHtml: string;
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bdquo: "„",
};
/** Decodes the entities DeepL may emit when plain-text fields are sent through HTML mode. */
function decodeEntities(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // titles/excerpts are plain text — drop any stray tag
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
    })
    .trim();
}

/**
 * Translates one post into a single target locale with ONE DeepL call: title & excerpt are sent as
 * escaped HTML text alongside the body HTML, so everything shares a request (and tag handling).
 * The translated body is converted back to Tiptap JSON and re-rendered/sanitized by the content pipeline.
 */
export async function translatePostTo(source: TranslationSource, target: Locale): Promise<TranslatedPost> {
  const [title = "", excerpt = "", html = ""] = await translateBatch(
    [escapeHtml(source.title), escapeHtml(source.excerpt), source.contentHtml],
    source.locale,
    target,
    { html: true },
  );
  const rendered = renderContent(htmlToJson(html), target);
  return {
    locale: target,
    title: decodeEntities(title),
    excerpt: decodeEntities(excerpt),
    contentJson: rendered.json,
    contentHtml: rendered.html,
    plainText: rendered.plainText,
    readingMinutes: rendered.readingMinutes,
  };
}

/** Translates into several locales in parallel (one API call per locale). Rejects if any fails. */
export async function translatePost(source: TranslationSource, targets: Locale[]): Promise<TranslatedPost[]> {
  const unique = [...new Set(targets)].filter((l) => l !== source.locale);
  return Promise.all(unique.map((target) => translatePostTo(source, target)));
}

/** DeepL tends to capitalise single words ("семья" → "Family"); keep the source's initial case. */
function matchInitialCase(text: string, like: string): string {
  const first = like.charAt(0);
  if (first && first === first.toLowerCase() && first !== first.toUpperCase()) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }
  return text;
}

/** Translates short plain strings (tag names) into each target locale; falls back to the original text. */
export async function translateLabels(labels: string[], from: Locale, targets: Locale[]): Promise<Record<Locale, string[]>> {
  const result = {} as Record<Locale, string[]>;
  result[from] = labels;
  await Promise.all(
    targets
      .filter((t) => t !== from)
      .map(async (target) => {
        try {
          const translated = await translateBatch(labels, from, target, { html: false });
          result[target] = translated.map((t, i) => matchInitialCase(t.trim().replace(/[.。]$/, ""), labels[i]!) || labels[i]!);
        } catch {
          result[target] = labels;
        }
      }),
  );
  return result;
}
