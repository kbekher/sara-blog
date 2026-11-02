import "server-only";
/**
 * Admin-side data access (uncached; always fresh). Callers MUST have verified the admin session.
 * Uses the Neon HTTP driver: no interactive transactions, so multi-statement writes go through `db.batch`.
 *
 * The site is Russian-only: a post's text is its `siteLocale` ("ru") row in `post_translations` (historical table
 * name; the schema is unchanged). Rows for other locales left over from the multilingual era are ignored.
 */
import { and, asc, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db";
import {
  postTags,
  postTranslations,
  posts,
  tags,
  type Post,
  type PostTranslation,
  type Tag,
} from "@/db/schema";
import type { PostEditorData, PostListItem, TagItem } from "@/lib/admin/types";
import { siteLocale } from "@/lib/i18n/config";
import { isCampaignConfigured } from "@/lib/services/newsletter-campaign";
import { nextFreeSlug, slugify } from "@/lib/services/slug";

/** A post with its text row (`siteLocale`; null for a post that has none yet) and tags. */
export type PostBundle = { post: Post; source: PostTranslation | null; tags: Tag[] };

/** Executes a dynamic list of statements as one atomic Neon batch. */
export async function runBatch(statements: BatchItem<"pg">[]): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}

/* ───────────────────────── Reads ───────────────────────── */

export async function getPostBundle(id: string): Promise<PostBundle | null> {
  const [postRows, sourceRows, tagRows] = await db.batch([
    db.select().from(posts).where(eq(posts.id, id)).limit(1),
    db
      .select()
      .from(postTranslations)
      .where(and(eq(postTranslations.postId, id), eq(postTranslations.locale, siteLocale)))
      .limit(1),
    db
      .select({ id: tags.id, slug: tags.slug, names: tags.names, createdAt: tags.createdAt })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, id))
      .orderBy(asc(tags.slug)),
  ]);
  const post = postRows[0];
  if (!post) return null;
  return { post, source: sourceRows[0] ?? null, tags: tagRows };
}

export function displayStatus(post: Pick<Post, "status" | "publishedAt">, now = new Date()): PostListItem["status"] {
  if (post.status !== "published") return "draft";
  return post.publishedAt && post.publishedAt.getTime() > now.getTime() ? "scheduled" : "published";
}

export function toEditorData(bundle: PostBundle): PostEditorData {
  const { post, source } = bundle;
  return {
    id: post.id,
    slug: post.slug,
    status: post.status,
    cover: post.cover ?? null,
    featured: post.featured,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
    tags: bundle.tags.map(toTagItem),
    newsletterSentAt: post.newsletterSentAt?.toISOString() ?? null,
    newsletterConfigured: isCampaignConfigured(),
    source: source
      ? { title: source.title, excerpt: source.excerpt, contentJson: source.contentJson }
      : { title: "", excerpt: "", contentJson: { type: "doc", content: [{ type: "paragraph" }] } },
  };
}

export async function listPostItems(): Promise<PostListItem[]> {
  // Light projection: the list needs no content.
  const [postRows, textRows] = await db.batch([
    db.select().from(posts).orderBy(desc(posts.updatedAt)),
    db
      .select({ postId: postTranslations.postId, title: postTranslations.title, excerpt: postTranslations.excerpt })
      .from(postTranslations)
      .where(eq(postTranslations.locale, siteLocale)),
  ]);

  const byPost = new Map(textRows.map((t) => [t.postId, t]));

  const now = new Date();
  return postRows.map((post) => {
    const source = byPost.get(post.id);
    return {
      id: post.id,
      slug: post.slug,
      title: source?.title ?? "",
      excerpt: source?.excerpt ?? "",
      status: displayStatus(post, now),
      cover: post.cover ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      updatedAt: post.updatedAt.toISOString(),
    };
  });
}

export async function listAllTags(): Promise<TagItem[]> {
  const rows = await db.select().from(tags).orderBy(asc(tags.slug));
  return rows.map(toTagItem);
}

function toTagItem(tag: Pick<Tag, "id" | "slug" | "names">): TagItem {
  return { id: tag.id, slug: tag.slug, name: tag.names.ru?.trim() || tag.slug };
}

/* ───────────────────────── Slugs ───────────────────────── */

/** Escapes LIKE wildcards (slugs can't contain them, but be safe). */
function likePrefix(value: string): string {
  return `${value.replace(/[\\%_]/g, (c) => `\\${c}`)}-%`;
}

export async function isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(excludeId ? and(eq(posts.slug, slug), ne(posts.id, excludeId)) : eq(posts.slug, slug))
    .limit(1);
  return rows.length > 0;
}

/** `base`, else `base-2`, `base-3`, … (ignoring the post being edited). */
export async function uniquePostSlug(base: string, excludeId?: string): Promise<string> {
  const match = or(eq(posts.slug, base), like(posts.slug, likePrefix(base)));
  const rows = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(excludeId ? and(match, ne(posts.id, excludeId)) : match);
  return nextFreeSlug(base, rows.map((r) => r.slug));
}

/* ───────────────────────── Tags ───────────────────────── */

export const MAX_TAGS = 10;

/** Trims, collapses whitespace, de-duplicates by slug; drops names that produce no slug. */
export function normalizeTagNames(names: string[]): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const out: { name: string; slug: string }[] = [];
  for (const raw of names) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const slug = slugify(name, siteLocale, 48);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ name, slug });
  }
  return out;
}

/**
 * Finds or creates tags by (transliterated) slug and returns their ids in input order.
 * New tags store their Russian name under all three keys of `tags.names` (the jsonb shape is unchanged).
 */
export async function resolveTagIds(names: { name: string; slug: string }[]): Promise<string[]> {
  if (names.length === 0) return [];
  const slugs = names.map((n) => n.slug);
  const existing = await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs));
  const known = new Set(existing.map((t) => t.slug));
  const missing = names.filter((n) => !known.has(n.slug));

  if (missing.length > 0) {
    await db
      .insert(tags)
      .values(missing.map((m) => ({ slug: m.slug, names: { ru: m.name, uk: m.name, en: m.name } })))
      .onConflictDoNothing({ target: tags.slug });
  }

  const rows =
    missing.length > 0
      ? await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs))
      : existing;
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
  return slugs.map((s) => idBySlug.get(s)).filter((id): id is string => Boolean(id));
}

/* ───────────────────────── Post text ───────────────────────── */

/** A post's rendered text, stored as its `siteLocale` row in `post_translations`. */
export type PostTextRow = {
  postId: string;
  title: string;
  excerpt: string;
  contentJson: PostTranslation["contentJson"];
  contentHtml: string;
  plainText: string;
  readingMinutes: number;
  updatedAt: Date;
};

/** INSERT … ON CONFLICT (post_id, locale) DO UPDATE of the post's `siteLocale` row — for use inside a batch. */
export function upsertPostText(row: PostTextRow) {
  const { postId: _postId, ...rest } = row;
  void _postId;
  // The author writes this text, so it is never "machine translated" (a column kept from the multilingual era).
  return db
    .insert(postTranslations)
    .values({ ...row, locale: siteLocale, isMachineTranslated: false })
    .onConflictDoUpdate({
      target: [postTranslations.postId, postTranslations.locale],
      set: { ...rest, isMachineTranslated: false },
    });
}

/* ───────────────────────── Blob cleanup helpers ───────────────────────── */

const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/i;

export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && BLOB_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * All Vercel Blob URLs a post owns: an uploaded cover plus images embedded in any of its text rows (including
 * rows for other locales left over from the multilingual era, which are deleted together with the post).
 */
export async function collectBlobUrls(post: Post): Promise<string[]> {
  const urls = new Set<string>();
  const cover = post.cover;
  if (cover?.source === "upload" && isBlobUrl(cover.url)) urls.add(cover.url);
  const rows = await db
    .select({ contentHtml: postTranslations.contentHtml })
    .from(postTranslations)
    .where(eq(postTranslations.postId, post.id));
  for (const row of rows) {
    for (const match of row.contentHtml.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) {
      const src = match[1]!.replace(/&amp;/g, "&");
      if (isBlobUrl(src)) urls.add(src);
    }
  }
  return [...urls];
}

/** URLs from `urls` that some OTHER post still references (cover or body) — these must not be deleted. */
export async function urlsReferencedElsewhere(urls: string[], postId: string): Promise<Set<string>> {
  const shared = new Set<string>();
  for (const url of urls) {
    const [coverHit, bodyHit] = await db.batch([
      db
        .select({ id: posts.id })
        .from(posts)
        .where(and(ne(posts.id, postId), sql`${posts.cover}->>'url' = ${url}`))
        .limit(1),
      db
        .select({ id: postTranslations.postId })
        .from(postTranslations)
        .where(and(ne(postTranslations.postId, postId), sql`strpos(${postTranslations.contentHtml}, ${url}) > 0`))
        .limit(1),
    ]);
    if (coverHit.length > 0 || bodyHit.length > 0) shared.add(url);
  }
  return shared;
}
