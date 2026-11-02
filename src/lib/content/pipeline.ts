/**
 * Content pipeline: Tiptap JSON ⇄ sanitized HTML, plain text and reading time.
 *
 * Uses the explicit `@tiptap/html/server` entry (backed by happy-dom, installed as a dependency of @tiptap/html):
 * the bare "@tiptap/html" import resolves to the browser build under CommonJS/tsx and throws in Node.
 * SERVER ONLY in practice (server actions, route handlers, server components). Client components must import
 * from "@/lib/content/extensions" | "/types" | "/typography" instead, and use `editor.getHTML()` for previews.
 */
import { generateHTML, generateJSON } from "@tiptap/html/server";
import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as PMNode, type Schema } from "@tiptap/pm/model";
import sanitize from "sanitize-html";
import type { Locale } from "@/lib/i18n/config";
import { getExtensions, isAllowedHref, isUnsplashProfileUrl, PHOTO_CREDIT_CLASS } from "./extensions";
import { readingMinutesFor } from "./stats";
import { TEXT_COLORS, type RenderedContent } from "./types";

const cachedExtensions = new Map<Locale, ReturnType<typeof getExtensions>>();
let cachedSchema: Schema | null = null;

/** Extension set for rendering in `locale` (only photo-credit wording differs; the schema is the same). */
function extensions(locale: Locale = "ru") {
  let list = cachedExtensions.get(locale);
  if (!list) {
    list = getExtensions(locale);
    cachedExtensions.set(locale, list);
  }
  return list;
}
function schema(): Schema {
  cachedSchema ??= getSchema(extensions());
  return cachedSchema;
}

export function emptyDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/* ───────────────────────── Sanitizer ───────────────────────── */

const ALIGN = [/^(left|center|right|justify)$/];

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "p", "br", "h2", "h3", "strong", "em", "u", "s", "code", "pre", "blockquote",
    "ul", "ol", "li", "hr", "a", "figure", "img", "figcaption", "span", "mark",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
    span: [{ name: "data-color", multiple: false, values: [...TEXT_COLORS] }, { name: "translate", multiple: false, values: ["no"] }],
    // Structured stock-photo credit (see FigureImage); values are validated in transformTags.figure.
    figure: [{ name: "data-source", multiple: false, values: ["unsplash"] }, "data-credit-name", "data-credit-url"],
    mark: [{ name: "data-highlight", multiple: false, values: [...TEXT_COLORS] }],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
    ol: ["start", "type"],
    code: ["class"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/], span: [PHOTO_CREDIT_CLASS] },
  allowedStyles: {
    p: { "text-align": ALIGN },
    h2: { "text-align": ALIGN },
    h3: { "text-align": ALIGN },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href?.trim() ?? "";
      if (!isAllowedHref(href)) {
        // Drop the href entirely; the anchor is then unwrapped by exclusiveFilter.
        return { tagName, attribs: {} };
      }
      const out: Record<string, string> = { href };
      if (attribs.title) out.title = attribs.title;
      if (isExternal(href)) {
        out.target = "_blank";
        out.rel = "noopener noreferrer nofollow";
      }
      return { tagName, attribs: out };
    },
    // A highlight without a valid palette name falls back to the default yellow.
    mark: (tagName, attribs) => ({
      tagName,
      attribs: { "data-highlight": (TEXT_COLORS as readonly string[]).includes(attribs["data-highlight"] ?? "") ? attribs["data-highlight"] : "yellow" },
    }),
    // Credit attributes only as a complete, valid set.
    figure: (tagName, attribs): sanitize.Tag => {
      const name = attribs["data-credit-name"]?.trim();
      const url = attribs["data-credit-url"]?.trim();
      if (attribs["data-source"] !== "unsplash" || !name || !isUnsplashProfileUrl(url)) return { tagName, attribs: {} };
      return { tagName, attribs: { "data-source": "unsplash", "data-credit-name": name, "data-credit-url": url } };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy", decoding: "async" },
    }),
  },
  exclusiveFilter: (frame) => {
    // Images without an (https) src are useless; anchors without href become plain text.
    if (frame.tag === "img") return !frame.attribs.src;
    if (frame.tag === "a" && !frame.attribs.href) return "excludeTag";
    // Color/highlight wrappers that lost their (invalid) value carry no meaning.
    if (frame.tag === "span" && !frame.attribs["data-color"] && frame.attribs.class !== PHOTO_CREDIT_CLASS) return "excludeTag";
    return false;
  },
};

/** Allow-list sanitizer matching exactly what the editor's extensions produce. */
export function sanitizeHtml(html: string): string {
  return sanitize(html, SANITIZE_OPTIONS);
}

/* ───────────────────────── JSON ⇄ HTML ───────────────────────── */

/** Validate a document against the schema and return it normalized (unknown attrs dropped). */
function toNode(doc: JSONContent): PMNode {
  try {
    const node = PMNode.fromJSON(schema(), doc);
    node.check();
    return node;
  } catch (error) {
    throw new Error(`Invalid editor document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Tiptap JSON → sanitized HTML (`locale` selects the photo-credit wording). */
export function jsonToHtml(doc: JSONContent, locale: Locale = "ru"): string {
  const normalized = toNode(doc).toJSON() as JSONContent;
  return sanitizeHtml(generateHTML(normalized, extensions(locale)));
}

/**
 * Normalize foreign HTML (machine-translation output, legacy content) before parsing:
 * h1 → h2 and h4–h6 → h3 so headings survive the [2, 3] level restriction.
 */
function normalizeHeadings(html: string): string {
  return html
    .replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2")
    .replace(/<(\/?)h[4-6](\s|>)/gi, "<$1h3$2");
}

/** HTML → Tiptap JSON (sanitized first; used after machine translation of HTML). */
export function htmlToJson(html: string): JSONContent {
  const clean = sanitizeHtml(normalizeHeadings(html));
  const json = generateJSON(clean, extensions()) as JSONContent;
  if (!json.content || json.content.length === 0) return emptyDoc();
  return json;
}

/* ───────────────────────── Plain text & reading time ───────────────────────── */

const BLOCK_SEPARATOR = "\n\n";

/** Plain text of a document: blocks separated by blank lines, hard breaks as newlines, image captions included. */
export function extractPlainText(doc: JSONContent): string {
  const blocks: string[] = [];

  const inline = (node: JSONContent): string => {
    if (node.type === "text") return node.text ?? "";
    if (node.type === "hardBreak") return "\n";
    return (node.content ?? []).map(inline).join("");
  };

  const walk = (node: JSONContent) => {
    switch (node.type) {
      case "paragraph":
      case "heading":
      case "codeBlock": {
        const text = inline(node).trim();
        if (text) blocks.push(text);
        return;
      }
      case "image": {
        const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
        if (caption) blocks.push(caption);
        return;
      }
      case "horizontalRule":
        return;
      default:
        (node.content ?? []).forEach(walk);
    }
  };

  walk(doc);
  return blocks.join(BLOCK_SEPARATOR);
}

function countImages(doc: JSONContent): number {
  let n = doc.type === "image" ? 1 : 0;
  for (const child of doc.content ?? []) n += countImages(child);
  return n;
}

/** A paragraph with no visible content: no children, or only whitespace text / hard breaks. */
function isEmptyParagraph(node: JSONContent): boolean {
  if (node.type !== "paragraph") return false;
  return (node.content ?? []).every(
    (child) => child.type === "hardBreak" || (child.type === "text" && !(child.text ?? "").trim()),
  );
}

/**
 * Drop leading and trailing empty paragraphs (blank lines the author left at the edges). Empty paragraphs
 * between blocks are left alone. An all-empty document keeps a single paragraph so it stays schema-valid.
 */
function trimEdgeParagraphs(doc: JSONContent): JSONContent {
  const content = doc.content ?? [];
  let start = 0;
  let end = content.length;
  while (start < end && isEmptyParagraph(content[start])) start++;
  while (end > start && isEmptyParagraph(content[end - 1])) end--;
  if (start === 0 && end === content.length) return doc;
  return { ...doc, content: start < end ? content.slice(start, end) : [{ type: "paragraph" }] };
}

/** Everything the save action needs for one translation: normalized JSON, sanitized HTML, plain text, reading time. */
export function renderContent(doc: JSONContent, locale: Locale = "ru"): RenderedContent {
  const json = trimEdgeParagraphs(toNode(doc).toJSON() as JSONContent);
  const html = sanitizeHtml(generateHTML(json, extensions(locale)));
  const plainText = extractPlainText(json);
  return { json, html, plainText, readingMinutes: readingMinutesFor(plainText, locale, countImages(json)) };
}
