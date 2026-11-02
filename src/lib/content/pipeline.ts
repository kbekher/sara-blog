import type { JSONContent } from "@tiptap/core";
import type { RenderedContent } from "./types";

// PLACEHOLDER — replaced by the editor agent.
export function emptyDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}
export function sanitizeHtml(html: string): string {
  throw new Error("not implemented: " + html.length);
}
export function jsonToHtml(doc: JSONContent): string {
  throw new Error("not implemented" + doc.type);
}
export function htmlToJson(html: string): JSONContent {
  throw new Error("not implemented" + html.length);
}
export function renderContent(doc: JSONContent): RenderedContent {
  throw new Error("not implemented" + doc.type);
}
