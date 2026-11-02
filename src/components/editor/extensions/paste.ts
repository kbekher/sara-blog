/**
 * Forgiving paste & drop:
 *  - HTML from Word / Google Docs / web pages is cleaned before ProseMirror parses it: styles, classes,
 *    fonts and junk are stripped, but semantic bold/italic/underline/strike (incl. Google Docs' styled
 *    <span>s), lists, links and headings are kept; h1 → h2, h4–h6 → h3; empty paragraphs and &nbsp; runs go.
 *    Copy/paste inside the editor itself (data-pm-slice) is left untouched.
 *  - Plain text: blank lines separate paragraphs, single newlines become line breaks
 *    (text without any blank line is split into one paragraph per line).
 *  - Image files (paste or drop) are handed to `onImageFiles` for upload.
 *  - Pasting a bare URL over a selection turns it into a link (Tiptap Link's linkOnPaste, enabled in getExtensions).
 */
import { Extension } from "@tiptap/core";
import { Fragment, Slice, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { isAllowedHref } from "@/lib/content/extensions";

export type PasteOptions = {
  /** Upload & insert images at `pos` (document position) or at the selection when null. */
  onImageFiles: (files: File[], pos: number | null) => void;
};

const DROP_TAGS = ["style", "script", "meta", "link", "title", "xml", "svg", "iframe", "object", "embed", "noscript", "template", "colgroup", "head"];
const KEEP_ATTRS: Record<string, string[]> = { a: ["href", "title"], img: ["src", "alt", "title", "width", "height"], ol: ["start"] };

function rename(el: Element, tag: string): Element {
  const next = el.ownerDocument.createElement(tag);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function wrapChildren(el: Element, tag: string) {
  const wrapper = el.ownerDocument.createElement(tag);
  while (el.firstChild) wrapper.appendChild(el.firstChild);
  el.appendChild(wrapper);
}

function isBlankText(text: string) {
  return text.replace(/[\s\u00A0​]/g, "") === "";
}

/** Convert Word's fake lists (<p class="MsoListParagraph…"> with a bullet span) into real <ul>/<ol>. */
function convertWordLists(body: HTMLElement) {
  const items = Array.from(body.querySelectorAll("p")).filter(
    (p) => /MsoListParagraph/i.test(p.className) || /mso-list:\s*l\d/i.test(p.getAttribute("style") ?? ""),
  );
  for (const p of items) {
    const marker = p.querySelector('span[style*="mso-list:Ignore" i], span[style*="mso-list: Ignore" i]');
    const markerText = marker?.textContent?.replace(/\s+/g, "") ?? "";
    marker?.remove();
    const ordered = /^\(?[\w]{1,3}[.)]$/.test(markerText);
    const tag = ordered ? "OL" : "UL";
    // Previous list items were moved into a list that now sits right before this paragraph.
    const prev = p.previousElementSibling;
    let list: Element;
    if (prev && prev.tagName === tag && prev.hasAttribute("data-word-list")) {
      list = prev;
    } else {
      list = body.ownerDocument.createElement(tag.toLowerCase());
      list.setAttribute("data-word-list", "");
      p.before(list);
    }
    const li = body.ownerDocument.createElement("li");
    while (p.firstChild) li.appendChild(p.firstChild);
    list.appendChild(li);
    p.remove();
  }
}

/** Clean foreign clipboard HTML into the subset our schema understands. Browser-only (uses DOMParser). */
export function cleanPastedHtml(html: string): string {
  if (html.includes("data-pm-slice")) return html; // our own editor's clipboard
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  // Comments (Word conditional comments etc.)
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  body.querySelectorAll(DROP_TAGS.join(",")).forEach((el) => el.remove());
  // Office namespaced tags like <o:p>.
  body.querySelectorAll("*").forEach((el) => {
    if (el.tagName.includes(":")) unwrap(el);
  });

  convertWordLists(body);

  // Google Docs wraps everything in <b style="font-weight:normal" id="docs-internal-guid-…">.
  body.querySelectorAll('b[id^="docs-internal-guid"], b[style*="font-weight:normal" i], b[style*="font-weight: normal" i]').forEach(unwrap);

  // Styled spans → semantic marks (Google Docs, Word, web pages).
  body.querySelectorAll<HTMLElement>("span[style], font[style]").forEach((el) => {
    const style = el.style;
    const weight = style.fontWeight;
    if (weight === "bold" || Number(weight) >= 600) wrapChildren(el, "strong");
    if (style.fontStyle === "italic") wrapChildren(el, "em");
    const deco = `${style.textDecoration} ${style.textDecorationLine}`;
    if (/underline/.test(deco)) wrapChildren(el, "u");
    if (/line-through/.test(deco)) wrapChildren(el, "s");
  });

  // Headings.
  body.querySelectorAll("h1").forEach((el) => rename(el, "h2"));
  body.querySelectorAll("h4, h5, h6").forEach((el) => rename(el, "h3"));
  // Bold-only "headings" inside headings are noise.
  body.querySelectorAll("h2 strong, h3 strong, h2 b, h3 b").forEach(unwrap);

  // Links: keep only safe hrefs.
  body.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || !isAllowedHref(href) || href.startsWith("#")) unwrap(a);
  });

  // Images: only https sources survive (data:/file:/blob: can't be stored).
  body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (!/^https:\/\//i.test(src)) img.remove();
  });

  // Unwrap presentational wrappers.
  body.querySelectorAll("span, font, section, article, main, header, footer, aside, center").forEach(unwrap);

  // Strip attributes.
  body.querySelectorAll("*").forEach((el) => {
    const keep = KEEP_ATTRS[el.tagName.toLowerCase()] ?? [];
    for (const attr of Array.from(el.attributes)) {
      if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
    }
  });

  // &nbsp; runs → single space (a single nbsp may be intentional typography).
  const textWalker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  while (textWalker.nextNode()) {
    const node = textWalker.currentNode as Text;
    const value = node.data.replace(/[ \u00A0]{2,}/g, " ").replace(/​/g, "");
    if (value !== node.data) node.data = value;
  }

  // Empty paragraphs / divs / headings.
  body.querySelectorAll("p, div, h2, h3, li").forEach((el) => {
    if (isBlankText(el.textContent ?? "") && !el.querySelector("img, br + br")) {
      if (el.tagName === "LI" && el.parentElement && el.parentElement.children.length > 1) el.remove();
      else if (el.tagName !== "LI") el.remove();
    }
  });
  // Leading/trailing <br> inside paragraphs.
  body.querySelectorAll("p").forEach((p) => {
    while (p.firstChild?.nodeName === "BR") p.removeChild(p.firstChild);
    while (p.lastChild?.nodeName === "BR") p.removeChild(p.lastChild);
  });

  return body.innerHTML;
}

/** Plain text → slice of paragraphs (open on both sides so it merges into the current paragraph). */
export function plainTextToSlice(text: string, schema: Schema): Slice {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\u00A0{2,}/g, " ").trim();
  const chunks = /\n[ \t]*\n/.test(normalized)
    ? normalized.split(/\n(?:[ \t]*\n)+/)
    : normalized.split("\n");
  const paragraphs: PMNode[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.replace(/[ \t]{2,}/g, " ").trimEnd());
    if (lines.every((l) => l.trim() === "")) continue;
    const content: PMNode[] = [];
    lines.forEach((line, i) => {
      if (i > 0) content.push(schema.nodes.hardBreak.create());
      if (line) content.push(schema.text(line));
    });
    paragraphs.push(schema.nodes.paragraph.create(null, content));
  }
  if (paragraphs.length === 0) return Slice.empty;
  return new Slice(Fragment.from(paragraphs), 1, 1);
}

function imageFiles(list: FileList | null | undefined): File[] {
  return list ? Array.from(list).filter((f) => f.type.startsWith("image/")) : [];
}

export const SmartPaste = Extension.create<PasteOptions>({
  name: "smartPaste",

  addOptions() {
    return { onImageFiles: () => {} };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey("smartPaste"),
        props: {
          transformPastedHTML: (html) => cleanPastedHtml(html),
          clipboardTextParser: (text, $context, plain, view) => {
            if ($context.parent.type.spec.code) {
              return new Slice(Fragment.from(view.state.schema.text(text.replace(/\r\n?/g, "\n"))), 0, 0);
            }
            return plainTextToSlice(text, view.state.schema);
          },
          handlePaste: (_view, event) => {
            const files = imageFiles(event.clipboardData?.files);
            if (!files.length) return false;
            event.preventDefault();
            options.onImageFiles(files, null);
            return true;
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false;
            const files = imageFiles(event.dataTransfer?.files);
            if (!files.length) return false;
            event.preventDefault();
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
            options.onImageFiles(files, coords ? coords.pos : null);
            return true;
          },
        },
      }),
    ];
  },
});
