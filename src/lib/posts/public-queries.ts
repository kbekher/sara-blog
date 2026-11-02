import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, count, desc, eq, gt, ilike, inArray, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, hasDatabase } from "@/db";
import { posts, postTags, postTranslations, tags, type CoverImage } from "@/db/schema";
import type { Locale } from "@/lib/i18n/config";

/**
 * Cached, read-only queries for the public site.
 *
 * Caching: every query is a `'use cache'` function tagged with POSTS_TAG (and `post:<slug>` where relevant).
 * The backend invalidates with `revalidateTag(POSTS_TAG, 'max')` / `updateTag(POSTS_TAG)` after mutations.
 * Scheduled posts (status = published, publishedAt > now) are filtered with the database clock (`now()`),
 * not JS `Date`, so cached results never embed a stale request time; the short `revalidate` below makes a
 * scheduled post go live within ~1 minute without any mutation/invalidation.
 *
 * Every query returns an empty result when DATABASE_URL is not configured (`hasDatabase === false`),
 * so builds and previews without a database still render (empty states).
 */

export const POSTS_TAG = "posts";
export const postTag = (slug: string) => `post:${slug}`;

/** stale ≥ 30s keeps results in prerenders; revalidate 60s lets scheduled posts appear within ~1 minute. */
const PUBLIC_CACHE_LIFE = { stale: 60, revalidate: 60, expire: 3600 } as const;

export const DEFAULT_PAGE_SIZE = 12;
const SEARCH_LIMIT = 30;
const SEARCH_MAX_QUERY = 100;

// ── Types ────────────────────────────────────────────────────────────────

export type TagRef = { slug: string; name: string };
export type TagWithCount = TagRef & { count: number };

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: CoverImage | null;
  featured: boolean;
  publishedAt: Date;
  readingMinutes: number;
  /** Locale of the translation actually returned. */
  locale: Locale;
  /** The post's authoring locale. */
  sourceLocale: Locale;
  /** true when the requested locale had no translation and the source-locale text is returned instead. */
  isFallback: boolean;
  tags: TagRef[];
};

export type PostDetail = PostSummary & {
  contentHtml: string;
  isMachineTranslated: boolean;
  updatedAt: Date;
};

export type PostPage = {
  posts: PostSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type SearchResult = PostSummary & {
  /** Plain-text excerpt around the first match (or the post excerpt if the match is only in the title). */
  snippet: string;
};

// ── Internals ────────────────────────────────────────────────────────────

/** Live = published and not scheduled in the future (database clock). */
function isLive(): SQL {
  return and(eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`))!;
}

const postColumns = {
  id: posts.id,
  slug: posts.slug,
  sourceLocale: posts.sourceLocale,
  cover: posts.cover,
  featured: posts.featured,
  publishedAt: posts.publishedAt,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
};
type PostRow = {
  id: string;
  slug: string;
  sourceLocale: Locale;
  cover: CoverImage | null;
  featured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TranslationRow = {
  postId: string;
  locale: Locale;
  title: string;
  excerpt: string;
  readingMinutes: number;
  isMachineTranslated: boolean;
  updatedAt: Date;
  contentHtml?: string;
};

/** A translation is usable only once it has a title (machine translation may still be pending). */
function pickTranslation(
  rows: TranslationRow[],
  locale: Locale,
  sourceLocale: Locale,
): { row: TranslationRow; isFallback: boolean } | null {
  const usable = rows.filter((r) => r.title.trim() !== "");
  const own = usable.find((r) => r.locale === locale);
  if (own) return { row: own, isFallback: false };
  const source = usable.find((r) => r.locale === sourceLocale) ?? usable[0];
  return source ? { row: source, isFallback: true } : null;
}

async function loadTags(postIds: string[], locale: Locale): Promise<Map<string, TagRef[]>> {
  const map = new Map<string, TagRef[]>();
  if (postIds.length === 0) return map;
  const rows = await db
    .select({ postId: postTags.postId, slug: tags.slug, names: tags.names })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(inArray(postTags.postId, postIds))
    .orderBy(asc(tags.slug));
  for (const r of rows) {
    const list = map.get(r.postId) ?? [];
    list.push({ slug: r.slug, name: tagName(r.names, locale, r.slug) });
    map.set(r.postId, list);
  }
  return map;
}

function tagName(names: { ru: string; uk: string; en: string } | null, locale: Locale, slug: string): string {
  return names?.[locale]?.trim() || names?.ru?.trim() || slug;
}

/**
 * Attaches the best translation and tags to post rows, preserving the input order.
 * Posts without any usable translation are dropped.
 */
async function hydrate(rows: PostRow[], locale: Locale): Promise<PostSummary[]>;
async function hydrate(rows: PostRow[], locale: Locale, withContent: true): Promise<PostDetail[]>;
async function hydrate(rows: PostRow[], locale: Locale, withContent = false): Promise<PostSummary[] | PostDetail[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const wantedLocales = Array.from(new Set<Locale>([locale, ...rows.map((r) => r.sourceLocale)]));

  const [translations, tagMap] = await Promise.all([
    db
      .select({
        postId: postTranslations.postId,
        locale: postTranslations.locale,
        title: postTranslations.title,
        excerpt: postTranslations.excerpt,
        readingMinutes: postTranslations.readingMinutes,
        isMachineTranslated: postTranslations.isMachineTranslated,
        updatedAt: postTranslations.updatedAt,
        // Only fetch the (large) HTML body when the caller renders it.
        ...(withContent ? { contentHtml: postTranslations.contentHtml } : {}),
      })
      .from(postTranslations)
      .where(and(inArray(postTranslations.postId, ids), inArray(postTranslations.locale, wantedLocales))),
    loadTags(ids, locale),
  ]);

  const byPost = new Map<string, TranslationRow[]>();
  for (const t of translations as TranslationRow[]) {
    const list = byPost.get(t.postId) ?? [];
    list.push(t);
    byPost.set(t.postId, list);
  }

  const summaries: PostSummary[] = [];
  const details: PostDetail[] = [];
  for (const p of rows) {
    const picked = pickTranslation(byPost.get(p.id) ?? [], locale, p.sourceLocale);
    if (!picked) continue;
    const { row, isFallback } = picked;
    const summary: PostSummary = {
      id: p.id,
      slug: p.slug,
      title: row.title,
      excerpt: row.excerpt,
      cover: p.cover ?? null,
      featured: p.featured,
      publishedAt: p.publishedAt ?? p.createdAt,
      readingMinutes: Math.max(1, row.readingMinutes),
      locale: row.locale,
      sourceLocale: p.sourceLocale,
      isFallback,
      tags: tagMap.get(p.id) ?? [],
    };
    // Detail-only fields stay out of summaries so cached list payloads remain small.
    if (withContent) {
      details.push({
        ...summary,
        contentHtml: row.contentHtml ?? "",
        isMachineTranslated: row.isMachineTranslated,
        updatedAt: row.updatedAt > p.updatedAt ? row.updatedAt : p.updatedAt,
      });
    } else {
      summaries.push(summary);
    }
  }
  return withContent ? details : summaries;
}

function toPositiveInt(value: number | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

// ── Public API ───────────────────────────────────────────────────────────

/** Paginated live posts, newest first. `excludeSlug` removes e.g. the home hero post from the list. */
export async function getPublishedPosts(
  locale: Locale,
  options: { page?: number; pageSize?: number; excludeSlug?: string } = {},
): Promise<PostPage> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG);

  const page = toPositiveInt(options.page, 1);
  const pageSize = toPositiveInt(options.pageSize, DEFAULT_PAGE_SIZE, 50);
  const empty: PostPage = { posts: [], total: 0, page, pageSize, pageCount: 0 };
  if (!hasDatabase) return empty;

  const where = options.excludeSlug ? and(isLive(), ne(posts.slug, options.excludeSlug)) : isLive();
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(posts).where(where),
    db
      .select(postColumns)
      .from(posts)
      .where(where)
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    posts: await hydrate(rows, locale),
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

/** The home hero: the most recent post marked `featured`, otherwise the latest post. */
export async function getFeaturedPost(locale: Locale): Promise<PostSummary | null> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG);
  if (!hasDatabase) return null;

  const rows = await db
    .select(postColumns)
    .from(posts)
    .where(isLive())
    .orderBy(desc(posts.featured), desc(posts.publishedAt), desc(posts.createdAt))
    .limit(1);
  const [post] = await hydrate(rows, locale);
  return post ?? null;
}

/**
 * A single live post with its body. If the requested locale has no usable translation, the source-locale
 * translation is returned with `isFallback: true`. Drafts and scheduled posts resolve to `null` (→ 404).
 */
export async function getPostBySlug(locale: Locale, slug: string): Promise<PostDetail | null> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG, postTag(slug));
  if (!hasDatabase) return null;

  const rows = await db
    .select(postColumns)
    .from(posts)
    .where(and(isLive(), eq(posts.slug, slug)))
    .limit(1);
  const [post] = await hydrate(rows, locale, true);
  return post ?? null;
}

/** Chronological neighbours of a post: `newer` was published after it, `older` before it. */
export async function getAdjacentPosts(
  locale: Locale,
  slug: string,
): Promise<{ newer: PostSummary | null; older: PostSummary | null }> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG, postTag(slug));
  const none = { newer: null, older: null };
  if (!hasDatabase) return none;

  const [current] = await db
    .select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(isLive(), eq(posts.slug, slug)))
    .limit(1);
  if (!current?.publishedAt) return none;

  const [newerRows, olderRows] = await Promise.all([
    db
      .select(postColumns)
      .from(posts)
      .where(and(isLive(), gt(posts.publishedAt, current.publishedAt), ne(posts.slug, slug)))
      .orderBy(asc(posts.publishedAt))
      .limit(1),
    db
      .select(postColumns)
      .from(posts)
      .where(and(isLive(), lt(posts.publishedAt, current.publishedAt), ne(posts.slug, slug)))
      .orderBy(desc(posts.publishedAt))
      .limit(1),
  ]);
  const [newer, older] = await Promise.all([hydrate(newerRows, locale), hydrate(olderRows, locale)]);
  return { newer: newer[0] ?? null, older: older[0] ?? null };
}

/** Tags that have at least one live post, with counts, most-used first. Names in the requested locale. */
export async function getAllTags(locale: Locale): Promise<TagWithCount[]> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG);
  if (!hasDatabase) return [];

  const rows = await db
    .select({ slug: tags.slug, names: tags.names, count: count(posts.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(isLive())
    .groupBy(tags.id, tags.slug, tags.names);

  return rows
    .map((r) => ({ slug: r.slug, name: tagName(r.names, locale, r.slug), count: r.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale));
}

/** A tag (name in locale) and its live posts, newest first; `null` if the tag doesn't exist. */
export async function getPostsByTag(
  locale: Locale,
  tagSlug: string,
): Promise<{ tag: TagRef; posts: PostSummary[] } | null> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG);
  if (!hasDatabase) return null;

  const [tag] = await db
    .select({ id: tags.id, slug: tags.slug, names: tags.names })
    .from(tags)
    .where(eq(tags.slug, tagSlug))
    .limit(1);
  if (!tag) return null;

  const rows = await db
    .select(postColumns)
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .where(and(isLive(), eq(postTags.tagId, tag.id)))
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

  return {
    tag: { slug: tag.slug, name: tagName(tag.names, locale, tag.slug) },
    posts: await hydrate(rows, locale),
  };
}

/** Escapes LIKE wildcards so user input is matched literally (Postgres' default escape char is `\`). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** ~220 chars of plain text around the first occurrence of `query`, trimmed to word boundaries. */
function makeSnippet(text: string, query: string, fallback: string): string {
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index === -1) return fallback;
  const before = 70;
  const after = 150;
  let start = Math.max(0, index - before);
  let end = Math.min(text.length, index + query.length + after);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < index) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > index + query.length) end = space;
  }
  return `${start > 0 ? "… " : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? " …" : ""}`;
}

/**
 * Case-insensitive search (ILIKE) over title, excerpt and full text of the requested locale's translations.
 * Only live posts. Title matches rank first, then newest first.
 */
export async function searchPosts(locale: Locale, rawQuery: string): Promise<SearchResult[]> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG);

  const query = rawQuery.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX_QUERY);
  if (!hasDatabase || query.length < 2) return [];

  const pattern = `%${escapeLike(query)}%`;
  const rows = await db
    .select({
      ...postColumns,
      title: postTranslations.title,
      excerpt: postTranslations.excerpt,
      plainText: postTranslations.plainText,
      readingMinutes: postTranslations.readingMinutes,
    })
    .from(postTranslations)
    .innerJoin(posts, eq(posts.id, postTranslations.postId))
    .where(
      and(
        isLive(),
        eq(postTranslations.locale, locale),
        ne(postTranslations.title, ""),
        or(
          ilike(postTranslations.title, pattern),
          ilike(postTranslations.excerpt, pattern),
          ilike(postTranslations.plainText, pattern),
        ),
      ),
    )
    .orderBy(desc(ilike(postTranslations.title, pattern)), desc(posts.publishedAt))
    .limit(SEARCH_LIMIT);

  const tagMap = await loadTags(
    rows.map((r) => r.id),
    locale,
  );

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    cover: r.cover ?? null,
    featured: r.featured,
    publishedAt: r.publishedAt ?? r.createdAt,
    readingMinutes: Math.max(1, r.readingMinutes),
    locale,
    sourceLocale: r.sourceLocale,
    isFallback: false,
    tags: tagMap.get(r.id) ?? [],
    snippet: makeSnippet(r.plainText, query, r.excerpt),
  }));
}

/** Every live post's slug and dates — for the sitemap. */
export async function getAllPublishedSlugs(): Promise<{ slug: string; publishedAt: Date; updatedAt: Date }[]> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG);
  if (!hasDatabase) return [];

  const rows = await db
    .select({ slug: posts.slug, publishedAt: posts.publishedAt, createdAt: posts.createdAt, updatedAt: posts.updatedAt })
    .from(posts)
    .where(isLive())
    .orderBy(desc(posts.publishedAt));
  return rows.map((r) => ({ slug: r.slug, publishedAt: r.publishedAt ?? r.createdAt, updatedAt: r.updatedAt }));
}

/** Latest live posts with full HTML bodies — for the RSS feed. */
export async function getFeedPosts(locale: Locale, limit = 20): Promise<PostDetail[]> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG);
  if (!hasDatabase) return [];

  const rows = await db
    .select(postColumns)
    .from(posts)
    .where(isLive())
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    .limit(toPositiveInt(limit, 20, 100));
  return hydrate(rows, locale, true);
}
