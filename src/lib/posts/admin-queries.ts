import "server-only";
/**
 * Admin-side data access (uncached; always fresh). Callers MUST have verified the admin session.
 * Uses the Neon HTTP driver: no interactive transactions, so multi-statement writes go through `db.batch`.
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
import type { PostEditorData, PostListItem } from "@/lib/admin/types";
import { locales, type Locale } from "@/lib/i18n/config";
import { hashSource } from "@/lib/services/content-hash";
import { nextFreeSlug, slugify } from "@/lib/services/slug";
import { isTranslatorConfigured } from "@/lib/services/translator";
import { translateLabels } from "@/lib/services/translate-post";

export type PostBundle = { post: Post; translations: PostTranslation[]; tags: Tag[] };
export type TagDto = { id: string; slug: string; names: Record<Locale, string> };

/** Executes a dynamic list of statements as one atomic Neon batch. */
export async function runBatch(statements: BatchItem<"pg">[]): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}

/* ───────────────────────── Reads ───────────────────────── */

export async function getPostBundle(id: string): Promise<PostBundle | null> {
  const [postRows, translationRows, tagRows] = await db.batch([
    db.select().from(posts).where(eq(posts.id, id)).limit(1),
    db.select().from(postTranslations).where(eq(postTranslations.postId, id)),
    db
      .select({ id: tags.id, slug: tags.slug, names: tags.names, createdAt: tags.createdAt })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, id))
      .orderBy(asc(tags.slug)),
  ]);
  const post = postRows[0];
  if (!post) return null;
  return { post, translations: translationRows, tags: tagRows };
}

export function sourceTranslation(bundle: PostBundle): PostTranslation | undefined {
  return bundle.translations.find((t) => t.locale === bundle.post.sourceLocale);
}

/** Current hash of the source translation's content (computed, not trusted from the row). */
export function currentSourceHash(bundle: PostBundle): string | null {
  const source = sourceTranslation(bundle);
  return source ? hashSource(source) : null;
}

export function isTranslationStale(t: PostTranslation, sourceLocale: Locale, sourceHash: string | null): boolean {
  if (t.locale === sourceLocale) return false;
  return !sourceHash || t.sourceHash !== sourceHash;
}

export function displayStatus(post: Pick<Post, "status" | "publishedAt">, now = new Date()): PostListItem["status"] {
  if (post.status !== "published") return "draft";
  return post.publishedAt && post.publishedAt.getTime() > now.getTime() ? "scheduled" : "published";
}

export function toEditorData(bundle: PostBundle): PostEditorData {
  const { post } = bundle;
  const sourceHash = currentSourceHash(bundle);
  const translations: PostEditorData["translations"] = {};
  for (const t of bundle.translations) {
    translations[t.locale] = {
      title: t.title,
      excerpt: t.excerpt,
      contentJson: t.contentJson,
      isMachineTranslated: t.isMachineTranslated,
      isStale: isTranslationStale(t, post.sourceLocale, sourceHash),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
  return {
    id: post.id,
    slug: post.slug,
    status: post.status,
    sourceLocale: post.sourceLocale,
    cover: post.cover ?? null,
    featured: post.featured,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
    tags: bundle.tags.map(toTagDto),
    translations,
  };
}

export async function listPostItems(): Promise<PostListItem[]> {
  // Light projection: the list needs no content. Staleness uses the source row's own stored hash
  // (the source translation's `sourceHash` is always written as the hash of itself on save).
  const [postRows, translationRows] = await db.batch([
    db.select().from(posts).orderBy(desc(posts.updatedAt)),
    db
      .select({
        postId: postTranslations.postId,
        locale: postTranslations.locale,
        title: postTranslations.title,
        excerpt: postTranslations.excerpt,
        sourceHash: postTranslations.sourceHash,
      })
      .from(postTranslations),
  ]);

  const byPost = new Map<string, typeof translationRows>();
  for (const t of translationRows) {
    const list = byPost.get(t.postId) ?? [];
    list.push(t);
    byPost.set(t.postId, list);
  }

  const now = new Date();
  return postRows.map((post) => {
    const rows = byPost.get(post.id) ?? [];
    const source = rows.find((t) => t.locale === post.sourceLocale);
    const fresh = rows
      .filter((t) => t.locale === post.sourceLocale || (source?.sourceHash && t.sourceHash === source.sourceHash))
      .map((t) => t.locale);
    return {
      id: post.id,
      slug: post.slug,
      title: source?.title ?? "",
      excerpt: source?.excerpt ?? "",
      status: displayStatus(post, now),
      cover: post.cover ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      updatedAt: post.updatedAt.toISOString(),
      locales: locales.filter((l) => fresh.includes(l)),
    };
  });
}

export async function listAllTags(): Promise<TagDto[]> {
  const rows = await db.select().from(tags).orderBy(asc(tags.slug));
  return rows.map(toTagDto);
}

function toTagDto(tag: Pick<Tag, "id" | "slug" | "names">): TagDto {
  return { id: tag.id, slug: tag.slug, names: { ru: tag.names.ru, uk: tag.names.uk, en: tag.names.en } };
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
export function normalizeTagNames(names: string[], sourceLocale: Locale): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const out: { name: string; slug: string }[] = [];
  for (const raw of names) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const slug = slugify(name, sourceLocale, 48);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ name, slug });
  }
  return out;
}

/**
 * Finds or creates tags by (transliterated) slug and returns their ids in input order.
 * New tags get display names translated by Microsoft Translator when configured, otherwise the source text everywhere.
 */
export async function resolveTagIds(names: { name: string; slug: string }[], sourceLocale: Locale): Promise<string[]> {
  if (names.length === 0) return [];
  const slugs = names.map((n) => n.slug);
  const existing = await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs));
  const known = new Set(existing.map((t) => t.slug));
  const missing = names.filter((n) => !known.has(n.slug));

  if (missing.length > 0) {
    const labels = missing.map((m) => m.name);
    const translated = isTranslatorConfigured()
      ? await translateLabels(labels, sourceLocale, [...locales])
      : ({ ru: labels, uk: labels, en: labels } as Record<Locale, string[]>);
    await db
      .insert(tags)
      .values(
        missing.map((m, i) => ({
          slug: m.slug,
          names: {
            ru: translated.ru?.[i] ?? m.name,
            uk: translated.uk?.[i] ?? m.name,
            en: translated.en?.[i] ?? m.name,
          },
        })),
      )
      .onConflictDoNothing({ target: tags.slug });
  }

  const rows =
    missing.length > 0
      ? await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs))
      : existing;
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
  return slugs.map((s) => idBySlug.get(s)).filter((id): id is string => Boolean(id));
}

/* ───────────────────────── Translations ───────────────────────── */

export type TranslationRow = {
  postId: string;
  locale: Locale;
  title: string;
  excerpt: string;
  contentJson: PostTranslation["contentJson"];
  contentHtml: string;
  plainText: string;
  readingMinutes: number;
  isMachineTranslated: boolean;
  sourceHash: string | null;
  updatedAt: Date;
};

/** INSERT … ON CONFLICT (post_id, locale) DO UPDATE — for use inside a batch. */
export function upsertTranslation(row: TranslationRow) {
  const { postId: _postId, locale: _locale, ...rest } = row;
  void _postId;
  void _locale;
  return db
    .insert(postTranslations)
    .values(row)
    .onConflictDoUpdate({ target: [postTranslations.postId, postTranslations.locale], set: rest });
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

/** All Vercel Blob URLs a post owns: an uploaded cover plus images embedded in any translation. */
export function collectBlobUrls(bundle: PostBundle): string[] {
  const urls = new Set<string>();
  const cover = bundle.post.cover;
  if (cover?.source === "upload" && isBlobUrl(cover.url)) urls.add(cover.url);
  for (const t of bundle.translations) {
    for (const match of t.contentHtml.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) {
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
