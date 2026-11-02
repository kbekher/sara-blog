/**
 * Crash-safety: a localStorage copy of the editor state per post ("new" for unsaved posts).
 * Written ~0.6 s after each change, removed after a successful server save with no newer edits.
 */
import type { JSONContent } from "@tiptap/core";
import type { CoverImage } from "@/db/schema";
import type { Locale } from "@/lib/i18n/config";

export type LocalDraftData = {
  slug: string;
  cover: CoverImage | null;
  featured: boolean;
  tagNames: string[];
  drafts: Partial<Record<Locale, { title: string; excerpt: string; contentJson: JSONContent }>>;
  edited: Locale[];
};

export type LocalDraft = { savedAt: string; data: LocalDraftData };

const PREFIX = "sara-editor:draft:";

export function draftKey(postId: string | null): string {
  return `${PREFIX}${postId ?? "new"}`;
}

export function readLocalDraft(postId: string | null): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(postId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft;
    if (!parsed || typeof parsed.savedAt !== "string" || !parsed.data?.drafts) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalDraft(postId: string | null, data: LocalDraftData): void {
  try {
    localStorage.setItem(draftKey(postId), JSON.stringify({ savedAt: new Date().toISOString(), data } satisfies LocalDraft));
  } catch {
    /* quota exceeded / private mode: the server autosave still works */
  }
}

export function removeLocalDraft(postId: string | null): void {
  try {
    localStorage.removeItem(draftKey(postId));
  } catch {
    /* ignore */
  }
}
