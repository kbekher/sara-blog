/**
 * Tiptap extension set shared by the admin editor, the server-side renderer and the DeepL round-trip.
 *
 * Server-safe: no React, no DOM access at import time. The editor (client) adds UI-only extensions on top
 * (placeholder, LanguageTool decorations, smart typography input rules, image node view, …) — those never
 * change the schema, so HTML/JSON produced on the server and in the browser are identical.
 *
 * Colors and highlights are stored by NAME (see TEXT_COLORS) and rendered as `data-color` / `data-highlight`
 * attributes; the actual colors are theme-aware CSS variables in globals.css. No inline hex ever reaches HTML.
 */
import { Mark, mergeAttributes, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image, { type ImageOptions } from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import type { Locale } from "@/lib/i18n/config";
import { TEXT_COLORS, type TextColor } from "./types";

export const TEXT_ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/** Heading levels available in the body (h1 is reserved for the post title). */
export const HEADING_LEVELS = [2, 3] as const;

/** Protocols allowed in links. Relative links ("/ru/posts/…", "#anchor") are allowed too. */
export const LINK_PROTOCOLS = ["http", "https", "mailto"] as const;

export function isTextColor(value: unknown): value is TextColor {
  return typeof value === "string" && (TEXT_COLORS as readonly string[]).includes(value);
}

/** true for http(s)/mailto URLs and site-relative paths; false for javascript:, data:, protocol-relative… */
export function isAllowedHref(href: string | null | undefined): boolean {
  if (!href) return false;
  const value = href.trim();
  if (value.startsWith("//")) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(value);
}

/* ───────────────────────── Text color mark ───────────────────────── */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textColor: {
      /** Apply a palette color (by name) to the selection. */
      setTextColor: (color: TextColor) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

/** `<span data-color="red">` — color by palette name. */
export const TextColorMark = Mark.create({
  name: "textColor",
  // Render inside links/bold etc. consistently; lower than Link (1000) so links wrap colored spans.
  priority: 101,

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-color");
          return isTextColor(value) ? value : null;
        },
        renderHTML: (attributes) => (isTextColor(attributes.color) ? { "data-color": attributes.color } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-color]",
        getAttrs: (element) => (isTextColor(element.getAttribute("data-color")) ? null : false),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ commands }) =>
          isTextColor(color) ? commands.setMark(this.name, { color }) : false,
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name, { extendEmptyMarkRange: true }),
    };
  },
});

/* ───────────────────────── Highlight (named colors) ───────────────────────── */

/** `<mark data-highlight="yellow">` — the stock multicolor Highlight writes inline styles; we store names. */
export const NamedHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: "yellow",
        parseHTML: (element) => {
          const value = element.getAttribute("data-highlight");
          return isTextColor(value) ? value : "yellow";
        },
        renderHTML: (attributes) => ({ "data-highlight": isTextColor(attributes.color) ? attributes.color : "yellow" }),
      },
    };
  },
}).configure({ multicolor: true });

/* ───────────────────────── Image with optional caption and photo credit ───────────────────────── */

/** UTM parameters required by the Unsplash API guidelines on every attribution link. */
export const UNSPLASH_UTM = "utm_source=sara_blog&utm_medium=referral";
export const UNSPLASH_HOME = "https://unsplash.com/";

/** Adds the Unsplash UTM parameters to a URL (idempotent). */
export function withUnsplashUtm(url: string): string {
  if (!url || url.includes("utm_source=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;
}

/** Image sources that carry a structured photographer credit. */
export const IMAGE_SOURCES = ["unsplash"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

function isImageSource(value: unknown): value is ImageSource {
  return typeof value === "string" && (IMAGE_SOURCES as readonly string[]).includes(value);
}

/** Photographer profile on unsplash.com (https only, no other hosts). */
export function isUnsplashProfileUrl(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/unsplash\.com\/@[^\s"<>]+$/.test(value.trim());
}

/** Profile URL without query/hash (UTM is added at render time), or null when it is not an Unsplash profile. */
export function canonicalUnsplashProfileUrl(value: unknown): string | null {
  if (!isUnsplashProfileUrl(value)) return null;
  const url = value.trim().replace(/[?#].*$/, "");
  return isUnsplashProfileUrl(url) ? url : null;
}

/** Localized wording around the two links: "{before}<a>Name</a>{middle}<a>Unsplash</a>{after}" (same as the cover). */
export type PhotoCreditLabel = { before: string; middle: string; after: string };
export const PHOTO_CREDIT_LABELS: Record<Locale, PhotoCreditLabel> = {
  ru: { before: "Фото: ", middle: " на ", after: "" },
  uk: { before: "Фото: ", middle: " на ", after: "" },
  en: { before: "Photo by ", middle: " on ", after: "" },
};

/** Class of the generated (never user-edited, never translated) credit line inside <figcaption>. */
export const PHOTO_CREDIT_CLASS = "photo-credit";

/** The <img> carrying the attributes: the element itself, or the first img inside a <figure>. */
function imgOf(element: HTMLElement): HTMLElement | null {
  if (element.tagName.toLowerCase() === "img") return element;
  return element.querySelector("img");
}

function intAttr(element: HTMLElement | null, name: string): number | null {
  const raw = element?.getAttribute(name);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Children of a DOM output spec array: text or nested element specs. */
type SpecChild = string | readonly [string, ...unknown[]];

function figureOf(element: HTMLElement): HTMLElement | null {
  return element.tagName.toLowerCase() === "figure" ? element : null;
}

/** Fallback when data-* attributes were lost: the photographer link inside the credit line. */
function creditLinkOf(element: HTMLElement): HTMLElement | null {
  const links = figureOf(element)?.querySelectorAll(`figcaption .${PHOTO_CREDIT_CLASS} a[href]`) ?? [];
  for (const a of Array.from(links)) {
    if (isUnsplashProfileUrl(a.getAttribute("href"))) return a as HTMLElement;
  }
  return null;
}

/** User caption = figcaption text WITHOUT the generated credit line. */
function captionOf(element: HTMLElement): string | null {
  const figcaption = figureOf(element)?.querySelector("figcaption");
  if (!figcaption) return null;
  const clone = figcaption.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`.${PHOTO_CREDIT_CLASS}`).forEach((el) => el.remove());
  const text = clone.textContent?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

type FigureImageOptions = ImageOptions & {
  /** Wording of the credit line; set per locale by the server renderer. */
  creditLabel: PhotoCreditLabel;
};

/**
 * Block image rendered as `<figure><img …><figcaption>…</figcaption></figure>`.
 * Parses both bare `<img>` and `<figure>` (DeepL translates the figcaption text; alt stays as authored).
 *
 * Stock photos carry a structured credit (`source`, `creditName`, `creditUrl`) stored as data-* attributes on
 * the <figure>. The visible credit line (`<span class="photo-credit" translate="no">Фото: <a>Name</a> на
 * <a>Unsplash</a></span>`) is always regenerated from those attributes and ignored when parsing the caption,
 * so a DeepL round-trip can never alter or duplicate it.
 */
export const FigureImage = Image.extend<FigureImageOptions>({
  draggable: true,

  addOptions() {
    return {
      ...(this.parent?.() as ImageOptions),
      creditLabel: PHOTO_CREDIT_LABELS.ru,
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => imgOf(element)?.getAttribute("src") ?? null,
      },
      alt: {
        default: null,
        parseHTML: (element) => imgOf(element)?.getAttribute("alt") ?? null,
      },
      title: {
        default: null,
        parseHTML: (element) => imgOf(element)?.getAttribute("title") ?? null,
      },
      width: {
        default: null,
        parseHTML: (element) => intAttr(imgOf(element), "width"),
      },
      height: {
        default: null,
        parseHTML: (element) => intAttr(imgOf(element), "height"),
      },
      caption: {
        default: null,
        parseHTML: (element) => captionOf(element),
        // Rendered as <figcaption> by renderHTML below, never as an attribute.
        renderHTML: () => ({}),
      },
      source: {
        default: null,
        parseHTML: (element) => {
          const figure = figureOf(element);
          const value = figure?.getAttribute("data-source");
          if (isImageSource(value)) return value;
          return creditLinkOf(element) ? "unsplash" : null;
        },
        renderHTML: () => ({}),
      },
      creditName: {
        default: null,
        parseHTML: (element) => {
          const value = figureOf(element)?.getAttribute("data-credit-name") ?? creditLinkOf(element)?.textContent;
          const name = value?.replace(/\s+/g, " ").trim();
          return name ? name : null;
        },
        renderHTML: () => ({}),
      },
      creditUrl: {
        default: null,
        parseHTML: (element) => {
          const value = figureOf(element)?.getAttribute("data-credit-url") ?? creditLinkOf(element)?.getAttribute("href");
          return canonicalUnsplashProfileUrl(value);
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        // Higher than the default 50 so <figure><img></figure> is consumed as one node.
        priority: 60,
        getAttrs: (element) => {
          const src = imgOf(element)?.getAttribute("src");
          return src && !src.startsWith("data:") ? null : false;
        },
      },
      { tag: 'img[src]:not([src^="data:"])' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const caption = typeof node.attrs.caption === "string" ? node.attrs.caption.trim() : "";
    const name = typeof node.attrs.creditName === "string" ? node.attrs.creditName.trim() : "";
    const url = canonicalUnsplashProfileUrl(node.attrs.creditUrl);
    const hasCredit = node.attrs.source === "unsplash" && !!name && !!url;

    const img = ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)] as const;
    const figureAttrs = hasCredit ? { "data-source": "unsplash", "data-credit-name": name, "data-credit-url": url } : {};

    const captionParts: SpecChild[] = [];
    if (caption) captionParts.push(caption);
    if (hasCredit) {
      const { before, middle, after } = this.options.creditLabel;
      const credit: SpecChild[] = [];
      if (before) credit.push(before);
      credit.push(["a", { href: withUnsplashUtm(url!) }, name]);
      if (middle) credit.push(middle);
      credit.push(["a", { href: withUnsplashUtm(UNSPLASH_HOME) }, "Unsplash"]);
      if (after) credit.push(after);
      captionParts.push(["span", { class: PHOTO_CREDIT_CLASS, translate: "no" }, ...credit]);
    }

    return captionParts.length
      ? ["figure", figureAttrs, img, ["figcaption", {}, ...captionParts]]
      : ["figure", figureAttrs, img];
  },
}).configure({ inline: false, allowBase64: false, resize: false });

/* ───────────────────────── Extension list ───────────────────────── */

/**
 * The schema-defining extension list. Server-safe. `locale` only selects the wording of photo credits.
 * The editor appends UI-only extensions; it must never remove or rename anything here.
 */
export function getExtensions(locale: Locale = "ru"): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: [...LINK_PROTOCOLS],
        isAllowedUri: (url) => isAllowedHref(url),
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow", class: null },
      },
      // Visual-only helpers; harmless on the server.
      dropcursor: { color: false, width: 2, class: "editor-dropcursor" },
    }),
    // Only the credit wording differs per locale; the schema is identical.
    FigureImage.configure({ creditLabel: PHOTO_CREDIT_LABELS[locale] }),
    TextColorMark,
    NamedHighlight,
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: [...TEXT_ALIGNMENTS] }),
  ];
}
