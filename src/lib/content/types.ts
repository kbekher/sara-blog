import type { JSONContent } from "@tiptap/core";

/** Allowed text colors / highlight names (mapped to theme-aware CSS vars in globals.css). */
export const TEXT_COLORS = ["gray", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export type RenderedContent = {
  json: JSONContent;
  /** Sanitized HTML safe to inject with dangerouslySetInnerHTML. */
  html: string;
  plainText: string;
  readingMinutes: number;
};
