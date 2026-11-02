/**
 * CONTRACT (implemented by the editor agent).
 * Server-safe content pipeline shared by the admin editor, the save/translate actions and the public site.
 *
 *  - `getExtensions()`  : the Tiptap extension list WITHOUT React/DOM-only pieces, usable on the server
 *  - `jsonToHtml(doc)`  : Tiptap JSON → sanitized HTML (uses @tiptap/html + sanitizeHtml)
 *  - `htmlToJson(html)` : HTML → Tiptap JSON (used after machine translation of HTML)
 *  - `sanitizeHtml(html)`: allow-list sanitizer matching exactly what the editor can produce
 *  - `renderContent(doc, locale?)`: { json, html, plainText, readingMinutes }
 *  - `extractPlainText(doc)`, `emptyDoc()`
 *  - typography helpers (`typographText`, …) — pure string functions
 *
 * Client components should import from "@/lib/content/extensions", "@/lib/content/types" or
 * "@/lib/content/typography" | "/stats" directly to avoid pulling sanitize-html into the browser bundle.
 */
export * from "./types";
export * from "./extensions";
export * from "./pipeline";
export * from "./typography";
export * from "./stats";
