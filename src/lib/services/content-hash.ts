import "server-only";
import { createHash } from "node:crypto";
import type { JSONContent } from "@tiptap/core";

/**
 * JSON.stringify with recursively sorted object keys.
 * Required because Postgres `jsonb` does NOT preserve key order: a document hashed before
 * insert and the same document read back must produce the same hash.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Hash of a source translation (title + excerpt + content). Stored on each derived translation as
 * `sourceHash`; a mismatch with the current source means the translation is stale.
 */
export function hashSource(source: { title: string; excerpt: string; contentJson: JSONContent }): string {
  return createHash("sha256")
    .update(stableStringify([source.title.trim(), source.excerpt.trim(), source.contentJson]))
    .digest("hex")
    .slice(0, 32);
}
