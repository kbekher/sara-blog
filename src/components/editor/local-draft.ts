/**
 * Crash-safety: a localStorage copy of the editor state per post ("new" for unsaved posts).
 * Written ~0.6 s after each change, removed after a successful server save with no newer edits.
 */
import type { JSONContent } from "@tiptap/core";
import type { CoverImage } from "@/db/schema";

export type LocalDraftData = {
  slug: string;
  cover: CoverImage | null;
  featured: boolean;
  location: string;
  tagNames: string[];
  draft: { title: string; excerpt: string; contentJson: JSONContent };
};

export type LocalDraft = { savedAt: string; data: LocalDraftData };

/** Backups written while the editor still had language tabs: `{ drafts: { ru: {…}, uk: {…} }, edited }`. */
type LegacyDraftData = Omit<LocalDraftData, "draft"> & { drafts?: { ru?: LocalDraftData["draft"] } };

const PREFIX = "sara-editor:draft:";

export function draftKey(postId: string | null): string {
  return `${PREFIX}${postId ?? "new"}`;
}

export function readLocalDraft(postId: string | null): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(postId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; data?: Partial<LocalDraftData> & LegacyDraftData };
    if (!parsed || typeof parsed.savedAt !== "string" || !parsed.data) return null;
    const { drafts, ...rest } = parsed.data;
    const draft = parsed.data.draft ?? drafts?.ru;
    if (!draft) return null;
    return {
      savedAt: parsed.savedAt,
      data: { slug: rest.slug ?? "", cover: rest.cover ?? null, featured: !!rest.featured, location: typeof rest.location === "string" ? rest.location : "", tagNames: rest.tagNames ?? [], draft },
    };
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
