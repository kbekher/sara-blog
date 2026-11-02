import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, count, desc, eq, gt, ilike, inArray, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, hasDatabase } from "@/db";
import { posts, postTags, postTranslations, tags, type CoverImage } from "@/db/schema";
import { siteLocale } from "@/lib/i18n/config";

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
 *
 * The site is Russian-only: posts are read from their `siteLocale` ("ru") row in `post_translations` (the table
 * name is historical — it simply holds each post's text). Tag names come from the `ru` key of `tags.names`.
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
  tags: TagRef[];
};

export type PostDetail = PostSummary & {
  contentHtml: string;
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
  cover: posts.cover,
  featured: posts.featured,
  publishedAt: posts.publishedAt,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
};
type PostRow = {
  id: string;
  slug: string;
  cover: CoverImage | null;
  featured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TextRow = {
  postId: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  updatedAt: Date;
  contentHtml?: string;
};

async function loadTags(postIds: string[]): Promise<Map<string, TagRef[]>> {
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
    list.push({ slug: r.slug, name: tagName(r.names, r.slug) });
    map.set(r.postId, list);
  }
  return map;
}

/** The tag's Russian display name (older rows may also carry uk/en names, which are ignored). */
function tagName(names: { ru: string } | null, slug: string): string {
  return names?.ru?.trim() || slug;
}

/**
 * Attaches the post text (the `siteLocale` row) and tags to post rows, preserving the input order.
 * Posts without a titled text row are dropped.
 */
async function hydrate(rows: PostRow[]): Promise<PostSummary[]>;
async function hydrate(rows: PostRow[], withContent: true): Promise<PostDetail[]>;
async function hydrate(rows: PostRow[], withContent = false): Promise<PostSummary[] | PostDetail[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [texts, tagMap] = await Promise.all([
    db
      .select({
        postId: postTranslations.postId,
        title: postTranslations.title,
        excerpt: postTranslations.excerpt,
        readingMinutes: postTranslations.readingMinutes,
        updatedAt: postTranslations.updatedAt,
        // Only fetch the (large) HTML body when the caller renders it.
        ...(withContent ? { contentHtml: postTranslations.contentHtml } : {}),
      })
      .from(postTranslations)
      .where(
        and(
          inArray(postTranslations.postId, ids),
          eq(postTranslations.locale, siteLocale),
          ne(postTranslations.title, ""),
        ),
      ),
    loadTags(ids),
  ]);

  const byPost = new Map<string, TextRow>();
  for (const t of texts as TextRow[]) byPost.set(t.postId, t);

  const summaries: PostSummary[] = [];
  const details: PostDetail[] = [];
  for (const p of rows) {
    const row = byPost.get(p.id);
    if (!row || !row.title.trim()) continue;
    const summary: PostSummary = {
      id: p.id,
      slug: p.slug,
      title: row.title,
      excerpt: row.excerpt,
      cover: p.cover ?? null,
      featured: p.featured,
      publishedAt: p.publishedAt ?? p.createdAt,
      readingMinutes: Math.max(1, row.readingMinutes),
      tags: tagMap.get(p.id) ?? [],
    };
    // Detail-only fields stay out of summaries so cached list payloads remain small.
    if (withContent) {
      details.push({
        ...summary,
        contentHtml: allowBrowserTranslation(row.contentHtml ?? ""),
        updatedAt: row.updatedAt > p.updatedAt ? row.updatedAt : p.updatedAt,
      });
    } else {
      summaries.push(summary);
    }
  }
  return withContent ? details : summaries;
}

/**
 * Posts saved before the site went Russian-only carry `translate="no"` on the generated photo-credit line
 * (`<span class="photo-credit" translate="no">`). The site now relies on browser translation, so that opt-out is
 * dropped at read time (new saves no longer produce it; no data migration needed).
 */
function allowBrowserTranslation(html: string): string {
  return html.replace(/\s+translate="no"/g, "");
}

function toPositiveInt(value: number | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

// ── Public API ───────────────────────────────────────────────────────────

/** Paginated live posts, newest first. `excludeSlug` removes e.g. the home hero post from the list. */
export async function getPublishedPosts(
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
    posts: await hydrate(rows),
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

/** The home hero: the most recent post marked `featured`, otherwise the latest post. */
export async function getFeaturedPost(): Promise<PostSummary | null> {
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
  const [post] = await hydrate(rows);
  return post ?? null;
}

/** A single live post with its body. Drafts and scheduled posts resolve to `null` (→ 404). */
export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  "use cache";
  cacheLife(PUBLIC_CACHE_LIFE);
  cacheTag(POSTS_TAG, postTag(slug));
  if (!hasDatabase) return null;

  const rows = await db
    .select(postColumns)
    .from(posts)
    .where(and(isLive(), eq(posts.slug, slug)))
    .limit(1);
  const [post] = await hydrate(rows, true);
  return post ?? null;
}

/** Chronological neighbours of a post: `newer` was published after it, `older` before it. */
export async function getAdjacentPosts(
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
  const [newer, older] = await Promise.all([hydrate(newerRows), hydrate(olderRows)]);
  return { newer: newer[0] ?? null, older: older[0] ?? null };
}

/** Tags that have at least one live post, with counts, most-used first. */
export async function getAllTags(): Promise<TagWithCount[]> {
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
    .map((r) => ({ slug: r.slug, name: tagName(r.names, r.slug), count: r.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, siteLocale));
}

/** A tag and its live posts, newest first; `null` if the tag doesn't exist. */
export async function getPostsByTag(
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
    tag: { slug: tag.slug, name: tagName(tag.names, tag.slug) },
    posts: await hydrate(rows),
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
 * Case-insensitive search (ILIKE) over the posts' title, excerpt and full text.
 * Only live posts. Title matches rank first, then newest first.
 */
export async function searchPosts(rawQuery: string): Promise<SearchResult[]> {
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
        eq(postTranslations.locale, siteLocale),
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

  const tagMap = await loadTags(rows.map((r) => r.id));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    cover: r.cover ?? null,
    featured: r.featured,
    publishedAt: r.publishedAt ?? r.createdAt,
    readingMinutes: Math.max(1, r.readingMinutes),
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
export async function getFeedPosts(limit = 20): Promise<PostDetail[]> {
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
  return hydrate(rows, true);
}
