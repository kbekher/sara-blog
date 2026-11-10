"use server";
/**
 * Admin Server Actions (contract: src/lib/admin/types.ts).
 * Every action re-verifies the admin session (the proxy alone is not a security boundary) and returns
 * `{ ok: false, error }` with a Russian, user-friendly message for expected failures.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { del } from "@vercel/blob";
import type { JSONContent } from "@tiptap/core";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { postTags, posts, siteSettings, type CoverImage } from "@/db/schema";
import type {
  ActionResult,
  PostEditorData,
  PostListItem,
  PublishInput,
  PublishResult,
  SavePostInput,
  TagItem,
} from "@/lib/admin/types";
import { LOGIN_PATH } from "@/lib/auth/config";
import { deleteSession, getSession } from "@/lib/auth/session";
import { renderContent } from "@/lib/content";
import { siteLocale } from "@/lib/i18n/config";
import {
  collectBlobUrls,
  getPostBundle,
  isSlugTaken,
  listAllTags,
  listPostItems,
  MAX_TAGS,
  normalizeTagNames,
  resolveTagIds,
  runBatch,
  toEditorData,
  uniquePostSlug,
  upsertPostText,
  urlsReferencedElsewhere,
} from "@/lib/posts/admin-queries";
import { cancelScheduledNewsletter, syncNewsletterOnPublish } from "@/lib/posts/newsletter";
import { POSTS_TAG, postTag } from "@/lib/posts/public-queries";
import { SITE_SETTING_KEYS, SITE_SETTINGS_TAG, type SiteSettings } from "@/lib/site-settings";
import { SLUG_MAX_LENGTH, SLUG_PATTERN, slugify } from "@/lib/services/slug";

/* ───────────────────────── Shared helpers ───────────────────────── */

type Failure = { ok: false; error: string; fieldErrors?: Record<string, string> };

const SESSION_EXPIRED: Failure = {
  ok: false,
  error: "Сессия истекла. Войдите снова в новой вкладке — несохранённый текст останется здесь.",
};
const NOT_FOUND: Failure = { ok: false, error: "Пост не найден — возможно, он был удалён." };

async function unauthorized(): Promise<Failure | null> {
  return (await getSession()) ? null : SESSION_EXPIRED;
}

function fail(error: string, fieldErrors?: Record<string, string>): Failure {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

function validationFailure(error: z.ZodError): Failure {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  const first = error.issues[0]?.message ?? "Проверьте введённые данные.";
  return fail(first, fieldErrors);
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Maps unexpected errors to a friendly message and logs the details server-side. */
function unexpected(action: string, error: unknown): Failure {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    return fail("База данных не настроена: задайте DATABASE_URL (см. README).");
  }
  console.error(`[admin:${action}]`, error);
  return fail("Что-то пошло не так. Попробуйте ещё раз через минуту.");
}

/** Read-your-writes for the public site (tags defined by the public queries module). */
/** Drops the admin dashboard from the client router cache so "back to list" shows fresh data. */
function invalidateAdminList() {
  revalidatePath("/admin");
}

function invalidatePublic(...slugs: (string | undefined | null)[]) {
  updateTag(POSTS_TAG);
  for (const slug of new Set(slugs)) if (slug) updateTag(postTag(slug));
}

/* ───────────────────────── Validation ───────────────────────── */

const ALLOWED_IMAGE_HOSTS = [/^images\.unsplash\.com$/i, /^plus\.unsplash\.com$/i, /\.public\.blob\.vercel-storage\.com$/i];

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

const httpsUrl = z.string().max(2048).refine(isHttpsUrl, "Ссылка должна начинаться с https://");

const coverSchema = z
  .object({
    url: z.string().max(2048).refine(isAllowedImageUrl, "Обложка должна быть фото из Unsplash или загруженным изображением."),
    alt: z.string().trim().max(300, "Описание обложки — не более 300 символов."),
    width: z.number().int().positive().max(20000).optional(),
    height: z.number().int().positive().max(20000).optional(),
    color: z.string().regex(/^#[0-9a-f]{3,8}$/i).optional(),
    blurDataURL: z.string().max(20000).startsWith("data:image/").optional(),
    source: z.enum(["unsplash", "upload"]),
    credit: z
      .object({
        name: z.string().max(200),
        username: z.string().max(100),
        profileUrl: httpsUrl,
        photoUrl: httpsUrl,
      })
      .optional(),
  })
  .nullable();

const docSchema = z.custom<JSONContent>(
  (v) => typeof v === "object" && v !== null && (v as JSONContent).type === "doc",
  "Некорректное содержимое документа.",
);

const contentSchema = z.object({
  title: z.string().max(200, "Заголовок — не более 200 символов."),
  excerpt: z.string().max(400, "Краткое описание — не более 400 символов."),
  contentJson: docSchema,
});

const LOCATION_MAX_LENGTH = 80;

/** «Место»: trimmed, whitespace collapsed; empty → null. */
const locationSchema = z
  .string()
  .nullish()
  .transform((v) => v?.replace(/\s+/g, " ").trim() || null)
  .refine((v) => v === null || v.length <= LOCATION_MAX_LENGTH, `Место — не более ${LOCATION_MAX_LENGTH} символов.`);

const saveSchema = z.object({
  id: z.uuid().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(SLUG_MAX_LENGTH, `Адрес — не более ${SLUG_MAX_LENGTH} символов.`)
    .refine((s) => s === "" || SLUG_PATTERN.test(s), "Адрес: только латиница, цифры и дефисы (например, moya-istoriya).")
    .optional(),
  cover: coverSchema,
  featured: z.boolean(),
  location: locationSchema,
  tagNames: z.array(z.string().max(40, "Тег — не более 40 символов.")).max(MAX_TAGS, `Не более ${MAX_TAGS} тегов.`),
  source: contentSchema,
});

const publishSchema = z.object({
  id: z.uuid("Некорректный идентификатор поста."),
  publishAt: z.iso.datetime({ offset: true, message: "Некорректная дата публикации." }).optional(),
  notify: z.boolean().optional(),
});

const idSchema = z.uuid("Некорректный идентификатор поста.");

/* ───────────────────────── Actions ───────────────────────── */

export async function listPosts(): Promise<ActionResult<PostListItem[]>> {
  const denied = await unauthorized();
  if (denied) return denied;
  try {
    return { ok: true, data: await listPostItems() };
  } catch (error) {
    return unexpected("listPosts", error);
  }
}

export async function getPost(id: string): Promise<ActionResult<PostEditorData>> {
  const denied = await unauthorized();
  if (denied) return denied;
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  try {
    const bundle = await getPostBundle(id);
    return bundle ? { ok: true, data: toEditorData(bundle) } : NOT_FOUND;
  } catch (error) {
    return unexpected("getPost", error);
  }
}

/** Create or update a draft/post; returns the post id & slug. Does NOT change status. */
export async function savePost(
  input: SavePostInput,
): Promise<ActionResult<{ id: string; slug: string; updatedAt: string }>> {
  const denied = await unauthorized();
  if (denied) return denied;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const data = parsed.data;

  try {
    const existing = data.id ? await getPostBundle(data.id) : null;
    if (data.id && !existing) return NOT_FOUND;

    const id = existing?.post.id ?? randomUUID();
    const now = new Date();

    // Content: normalized & rendered by the shared pipeline (sanitized HTML, plain text, reading time).
    const rendered = renderContent(data.source.contentJson);
    const source = { title: data.source.title.trim(), excerpt: data.source.excerpt.trim(), contentJson: rendered.json };

    // Slug: explicit value wins; otherwise stable once the post has ever been published,
    // and regenerated from the title while it's still an unpublished draft.
    const requested = data.slug?.trim();
    let slug: string;
    if (requested) {
      if (requested !== existing?.post.slug && (await isSlugTaken(requested, id))) {
        return fail("Такой адрес уже занят другим постом.", { slug: "Такой адрес уже занят другим постом." });
      }
      slug = requested;
    } else if (existing && (existing.post.publishedAt || existing.post.status === "published")) {
      slug = existing.post.slug;
    } else {
      const base = slugify(source.title, siteLocale) || existing?.post.slug || `post-${id.slice(0, 8)}`;
      slug = await uniquePostSlug(base, id);
    }

    const tagIds = await resolveTagIds(normalizeTagNames(data.tagNames).slice(0, MAX_TAGS));

    const cover = (data.cover ?? null) as CoverImage | null;
    await runBatch([
      existing
        ? db
            .update(posts)
            .set({ slug, cover, featured: data.featured, location: data.location, sourceLocale: siteLocale, updatedAt: now })
            .where(eq(posts.id, id))
        : db.insert(posts).values({
            id,
            slug,
            status: "draft",
            sourceLocale: siteLocale,
            cover,
            featured: data.featured,
            location: data.location,
            createdAt: now,
            updatedAt: now,
          }),
      upsertPostText({
        postId: id,
        ...source,
        contentHtml: rendered.html,
        plainText: rendered.plainText,
        readingMinutes: rendered.readingMinutes,
        updatedAt: now,
      }),
      db.delete(postTags).where(eq(postTags.postId, id)),
      ...(tagIds.length > 0 ? [db.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId })))] : []),
    ]);

    invalidateAdminList();
    if (existing?.post.status === "published") invalidatePublic(slug, existing.post.slug);

    return { ok: true, data: { id, slug, updatedAt: now.toISOString() } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("Такой адрес уже занят другим постом.", { slug: "Такой адрес уже занят другим постом." });
    }
    return unexpected("savePost", error);
  }
}

/** Publish now or schedule. */
export async function publishPost(input: PublishInput): Promise<ActionResult<PublishResult>> {
  const denied = await unauthorized();
  if (denied) return denied;
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { id, publishAt, notify = true } = parsed.data;

  try {
    const bundle = await getPostBundle(id);
    if (!bundle) return NOT_FOUND;
    const { post, source } = bundle;
    if (!source || !source.title.trim()) {
      return fail("Добавьте заголовок перед публикацией.", { title: "Добавьте заголовок." });
    }
    if (!source.plainText.trim() && !/<img\b/i.test(source.contentHtml)) {
      return fail("Пост пустой — добавьте текст перед публикацией.");
    }

    const now = new Date();
    const requestedAt = publishAt ? new Date(publishAt) : null;
    let publishedAt: Date;
    if (requestedAt && requestedAt.getTime() > now.getTime()) {
      publishedAt = requestedAt; // scheduled
    } else if (!requestedAt && post.status === "published" && post.publishedAt && post.publishedAt <= now) {
      publishedAt = post.publishedAt; // re-publishing a live post keeps its original date
    } else {
      publishedAt = now;
    }

    await db.update(posts).set({ status: "published", publishedAt, updatedAt: now }).where(eq(posts.id, id));

    invalidatePublic(post.slug);
    invalidateAdminList();

    // Email the subscribers (once per post). Never fails the publish — the outcome is reported to the UI.
    const newsletter = await syncNewsletterOnPublish({
      post,
      content: { slug: post.slug, title: source.title, excerpt: source.excerpt, plainText: source.plainText, cover: post.cover ?? null },
      publishedAt,
      notify,
      now,
    }).catch((error: unknown): PublishResult["newsletter"] => {
      console.error("[admin:publishPost] newsletter", error);
      return { status: "failed", message: "Не удалось отправить письмо подписчикам.", newsletterSentAt: post.newsletterSentAt?.toISOString() ?? null };
    });

    return {
      ok: true,
      data: {
        status: publishedAt.getTime() > now.getTime() ? "scheduled" : "published",
        publishedAt: publishedAt.toISOString(),
        newsletter,
      },
    };
  } catch (error) {
    return unexpected("publishPost", error);
  }
}

export async function unpublishPost(id: string): Promise<ActionResult> {
  const denied = await unauthorized();
  if (denied) return denied;
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  try {
    // publishedAt is kept: it marks the post as "was public once", which keeps its slug stable.
    const [row] = await db
      .update(posts)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning({ id: posts.id, slug: posts.slug, newsletterCampaignId: posts.newsletterCampaignId, newsletterSentAt: posts.newsletterSentAt });
    if (!row) return NOT_FOUND;
    invalidatePublic(row.slug);
    invalidateAdminList();
    // A scheduled email must not go out for a post that is no longer public (best-effort; logged on failure).
    await cancelScheduledNewsletter(row);
    return { ok: true };
  } catch (error) {
    return unexpected("unpublishPost", error);
  }
}

export async function deletePost(id: string): Promise<ActionResult> {
  const denied = await unauthorized();
  if (denied) return denied;
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  try {
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) return NOT_FOUND;

    const blobUrls = await collectBlobUrls(post);
    const shared = blobUrls.length > 0 ? await urlsReferencedElsewhere(blobUrls, id) : new Set<string>();

    await cancelScheduledNewsletter(post, { store: null }); // best-effort; never fails the action
    await db.delete(posts).where(eq(posts.id, id)); // post text rows & post_tags cascade
    if (post.status === "published") invalidatePublic(post.slug);
    invalidateAdminList();

    // Best-effort cleanup of uploaded images no other post uses; never fails the action.
    const orphans = blobUrls.filter((url) => !shared.has(url));
    if (orphans.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
      await del(orphans).catch((error) => console.warn("[admin:deletePost] Blob cleanup failed", error));
    }
    return { ok: true };
  } catch (error) {
    return unexpected("deletePost", error);
  }
}

export async function listTags(): Promise<ActionResult<TagItem[]>> {
  const denied = await unauthorized();
  if (denied) return denied;
  try {
    return { ok: true, data: await listAllTags() };
  } catch (error) {
    return unexpected("listTags", error);
  }
}

/* ───────────────────────── Site settings ───────────────────────── */

/** Hero portrait: same rules as a cover, but the description (alt) is required. */
const heroPortraitSchema = coverSchema.refine(
  (c) => c === null || c.alt.length > 0,
  { message: "Добавьте описание фото — его прочитают незрячие читатели.", path: ["alt"] },
);

/** Site-wide settings, fresh from the database (the public site reads the cached `getSiteSettings()`). */
export async function getSiteSettingsAdmin(): Promise<ActionResult<SiteSettings>> {
  const denied = await unauthorized();
  if (denied) return denied;
  try {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, SITE_SETTING_KEYS.heroPortrait))
      .limit(1);
    return { ok: true, data: { heroPortrait: (row?.value as CoverImage | null | undefined) ?? null } };
  } catch (error) {
    return unexpected("getSiteSettingsAdmin", error);
  }
}

/** Set (or clear with null) the portrait in the home hero. */
export async function saveHeroPortrait(cover: CoverImage | null): Promise<ActionResult<{ heroPortrait: CoverImage | null }>> {
  const denied = await unauthorized();
  if (denied) return denied;
  const parsed = heroPortraitSchema.safeParse(cover);
  if (!parsed.success) return validationFailure(parsed.error);
  const value = (parsed.data ?? null) as CoverImage | null;
  try {
    const now = new Date();
    if (value) {
      await db
        .insert(siteSettings)
        .values({ key: SITE_SETTING_KEYS.heroPortrait, value, updatedAt: now })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: now } });
    } else {
      await db.delete(siteSettings).where(eq(siteSettings.key, SITE_SETTING_KEYS.heroPortrait));
    }
    updateTag(SITE_SETTINGS_TAG);
    return { ok: true, data: { heroPortrait: value } };
  } catch (error) {
    return unexpected("saveHeroPortrait", error);
  }
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect(LOGIN_PATH);
}
