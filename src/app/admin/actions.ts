"use server";
/**
 * CONTRACT — PLACEHOLDER. Implemented by the backend agent. Signatures are fixed (see src/lib/admin/types.ts).
 * Every action must verify the admin session first.
 */
import type {
  ActionResult,
  PostEditorData,
  PostListItem,
  PublishInput,
  SavePostInput,
} from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";

const todo = (): never => {
  throw new Error("not implemented");
};

export async function listPosts(): Promise<ActionResult<PostListItem[]>> { return todo(); }
export async function getPost(id: string): Promise<ActionResult<PostEditorData>> { void id; return todo(); }
/** Create or update a draft/post; returns the post id & slug. Does NOT change status. */
export async function savePost(input: SavePostInput): Promise<ActionResult<{ id: string; slug: string; updatedAt: string }>> { void input; return todo(); }
/** Publish now or schedule. Translates missing/stale locales via DeepL unless translate=false. */
export async function publishPost(input: PublishInput): Promise<ActionResult<{ status: "published" | "scheduled"; publishedAt: string }>> { void input; return todo(); }
export async function unpublishPost(id: string): Promise<ActionResult> { void id; return todo(); }
export async function deletePost(id: string): Promise<ActionResult> { void id; return todo(); }
/** Re-run DeepL for given locales (default: all non-source), overwriting them. */
export async function retranslatePost(id: string, locales?: Locale[]): Promise<ActionResult<PostEditorData>> { void id; void locales; return todo(); }
export async function listTags(): Promise<ActionResult<{ id: string; slug: string; names: Record<Locale, string> }[]>> { return todo(); }
export async function logout(): Promise<void> { return todo(); }
