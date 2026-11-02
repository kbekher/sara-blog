/**
 * CONTRACT (implemented by the editor agent).
 * Server-safe content pipeline shared by the admin editor, the save/translate actions and the public site.
 *
 *  - `getExtensions()`  : the Tiptap extension list WITHOUT React/DOM-only pieces, usable on the server
 *  - `jsonToHtml(doc)`  : Tiptap JSON → sanitized HTML (uses @tiptap/html + sanitizeHtml)
 *  - `htmlToJson(html)` : HTML → Tiptap JSON (used after DeepL translates HTML)
 *  - `sanitizeHtml(html)`: allow-list sanitizer matching exactly what the editor can produce
 *  - `renderContent(doc)`: { json, html, plainText, readingMinutes }
 *  - `emptyDoc()`
 */
export * from "./types";
export * from "./pipeline";
