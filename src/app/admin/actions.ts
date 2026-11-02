"use server";
/**
 * Admin Server Actions (contract: src/lib/admin/types.ts).
 * Every action re-verifies the admin session (the proxy alone is not a security boundary) and returns
 * `{ ok: false, error }` with a Russian, user-friendly message for expected failures.
 */
import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { del } from "@vercel/blob";
import type { JSONContent } from "@tiptap/core";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { postTags, postTranslations, posts, type CoverImage } from "@/db/schema";
import type {
  ActionResult,
  PostEditorData,
  PostListItem,
  PublishInput,
  SavePostInput,
} from "@/lib/admin/types";
import { LOGIN_PATH } from "@/lib/auth/config";
import { deleteSession, getSession } from "@/lib/auth/session";
import { renderContent } from "@/lib/content";
import { isLocale, locales, sourceLocale as defaultSourceLocale, type Locale } from "@/lib/i18n/config";
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
  sourceTranslation,
  toEditorData,
  uniquePostSlug,
  upsertTranslation,
  urlsReferencedElsewhere,
  isTranslationStale,
  type TranslationRow,
} from "@/lib/posts/admin-queries";
import { POSTS_TAG, postTag } from "@/lib/posts/public-queries";
import { hashSource } from "@/lib/services/content-hash";
import { isDeepLConfigured, TranslationError } from "@/lib/services/deepl";
import { SLUG_MAX_LENGTH, SLUG_PATTERN, slugify } from "@/lib/services/slug";
import { translatePost } from "@/lib/services/translate-post";

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
  if (error instanceof TranslationError) return fail(error.userMessage);
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    return fail("База данных не настроена: задайте DATABASE_URL (см. README).");
  }
  console.error(`[admin:${action}]`, error);
  return fail("Что-то пошло не так. Попробуйте ещё раз через минуту.");
}

/** Read-your-writes for the public site (tags defined by the public queries module). */
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

const translationSchema = z.object({
  title: z.string().max(200, "Заголовок — не более 200 символов."),
  excerpt: z.string().max(400, "Краткое описание — не более 400 символов."),
  contentJson: docSchema,
});

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
  tagNames: z.array(z.string().max(40, "Тег — не более 40 символов.")).max(MAX_TAGS, `Не более ${MAX_TAGS} тегов.`),
  source: translationSchema,
  translations: z.partialRecord(z.enum(locales), translationSchema).optional(),
});

const publishSchema = z.object({
  id: z.uuid("Некорректный идентификатор поста."),
  publishAt: z.iso.datetime({ offset: true, message: "Некорректная дата публикации." }).optional(),
  translate: z.boolean().optional(),
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
    const sourceLocale: Locale = existing?.post.sourceLocale ?? defaultSourceLocale;
    const now = new Date();

    // Source content: normalized & rendered by the shared pipeline (sanitized HTML, plain text, reading time).
    const rendered = renderContent(data.source.contentJson, sourceLocale);
    const source = { title: data.source.title.trim(), excerpt: data.source.excerpt.trim(), contentJson: rendered.json };
    const sourceHash = hashSource(source);

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
      const base = slugify(source.title, sourceLocale) || existing?.post.slug || `post-${id.slice(0, 8)}`;
      slug = await uniquePostSlug(base, id);
    }

    const tagIds = await resolveTagIds(normalizeTagNames(data.tagNames, sourceLocale).slice(0, MAX_TAGS), sourceLocale);

    const translationRows: TranslationRow[] = [
      {
        postId: id,
        locale: sourceLocale,
        ...source,
        contentHtml: rendered.html,
        plainText: rendered.plainText,
        readingMinutes: rendered.readingMinutes,
        isMachineTranslated: false,
        // The source row stores the hash of itself: lets the post list detect stale translations cheaply.
        sourceHash,
        updatedAt: now,
      },
    ];

    for (const [locale, t] of Object.entries(data.translations ?? {})) {
      if (!t || !isLocale(locale) || locale === sourceLocale) continue;
      const previous = existing?.translations.find((row) => row.locale === locale);
      const r = renderContent(t.contentJson, locale);
      const next = { title: t.title.trim(), excerpt: t.excerpt.trim(), contentJson: r.json };
      // Unchanged (e.g. an untouched machine translation sent back by the editor) → keep its flags.
      if (previous && hashSource(previous) === hashSource(next)) continue;
      translationRows.push({
        postId: id,
        locale,
        ...next,
        contentHtml: r.html,
        plainText: r.plainText,
        readingMinutes: r.readingMinutes,
        isMachineTranslated: false,
        sourceHash,
        updatedAt: now,
      });
    }

    const cover = (data.cover ?? null) as CoverImage | null;
    await runBatch([
      existing
        ? db.update(posts).set({ slug, cover, featured: data.featured, updatedAt: now }).where(eq(posts.id, id))
        : db.insert(posts).values({
            id,
            slug,
            status: "draft",
            sourceLocale,
            cover,
            featured: data.featured,
            createdAt: now,
            updatedAt: now,
          }),
      ...translationRows.map(upsertTranslation),
      db.delete(postTags).where(eq(postTags.postId, id)),
      ...(tagIds.length > 0 ? [db.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId })))] : []),
    ]);

    if (existing?.post.status === "published") invalidatePublic(slug, existing.post.slug);

    return { ok: true, data: { id, slug, updatedAt: now.toISOString() } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("Такой адрес уже занят другим постом.", { slug: "Такой адрес уже занят другим постом." });
    }
    return unexpected("savePost", error);
  }
}

/** Publish now or schedule. Translates missing/stale locales via DeepL unless translate=false. */
export async function publishPost(
  input: PublishInput,
): Promise<ActionResult<{ status: "published" | "scheduled"; publishedAt: string }>> {
  const denied = await unauthorized();
  if (denied) return denied;
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { id, publishAt, translate = true } = parsed.data;

  try {
    const bundle = await getPostBundle(id);
    if (!bundle) return NOT_FOUND;
    const { post } = bundle;
    const source = sourceTranslation(bundle);
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

    const sourceHash = hashSource(source);
    const rows: TranslationRow[] = [];

    if (translate) {
      if (!isDeepLConfigured()) {
        console.warn("[admin:publishPost] DEEPL_API_KEY not set — publishing without translations (site falls back to the source language).");
      } else {
        // Missing locales and stale MACHINE translations are (re)translated. Hand-edited translations are
        // never overwritten automatically (use "retranslate" for that); they keep showing as stale in the editor.
        const targets = locales.filter((locale) => {
          if (locale === post.sourceLocale) return false;
          const existing = bundle.translations.find((t) => t.locale === locale);
          if (!existing) return true;
          return existing.isMachineTranslated && isTranslationStale(existing, post.sourceLocale, sourceHash);
        });
        const translated = await translatePost(
          { locale: post.sourceLocale, title: source.title, excerpt: source.excerpt, contentHtml: source.contentHtml },
          targets,
        );
        for (const t of translated) {
          rows.push({ postId: id, ...t, isMachineTranslated: true, sourceHash, updatedAt: now });
        }
      }
    }

    await runBatch([
      db.update(posts).set({ status: "published", publishedAt, updatedAt: now }).where(eq(posts.id, id)),
      ...rows.map(upsertTranslation),
      ...(source.sourceHash !== sourceHash
        ? [
            db
              .update(postTranslations)
              .set({ sourceHash })
              .where(and(eq(postTranslations.postId, id), eq(postTranslations.locale, post.sourceLocale))),
          ]
        : []),
    ]);

    invalidatePublic(post.slug);
    return {
      ok: true,
      data: { status: publishedAt.getTime() > now.getTime() ? "scheduled" : "published", publishedAt: publishedAt.toISOString() },
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
      .returning({ slug: posts.slug });
    if (!row) return NOT_FOUND;
    invalidatePublic(row.slug);
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
    const bundle = await getPostBundle(id);
    if (!bundle) return NOT_FOUND;

    const blobUrls = collectBlobUrls(bundle);
    const shared = blobUrls.length > 0 ? await urlsReferencedElsewhere(blobUrls, id) : new Set<string>();

    await db.delete(posts).where(eq(posts.id, id)); // translations & post_tags cascade
    if (bundle.post.status === "published") invalidatePublic(bundle.post.slug);

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

/** Re-run DeepL for given locales (default: all non-source), overwriting them. */
export async function retranslatePost(id: string, targetLocales?: Locale[]): Promise<ActionResult<PostEditorData>> {
  const denied = await unauthorized();
  if (denied) return denied;
  if (!idSchema.safeParse(id).success) return NOT_FOUND;
  if (targetLocales && !targetLocales.every((l) => isLocale(l))) return fail("Неизвестный язык перевода.");
  if (!isDeepLConfigured()) return fail("Перевод недоступен: не задан DEEPL_API_KEY (см. README).");

  try {
    const bundle = await getPostBundle(id);
    if (!bundle) return NOT_FOUND;
    const { post } = bundle;
    const source = sourceTranslation(bundle);
    if (!source || (!source.title.trim() && !source.plainText.trim())) {
      return fail("Нечего переводить — сначала напишите и сохраните текст.");
    }

    const targets = (targetLocales ?? [...locales]).filter((l) => l !== post.sourceLocale);
    if (targets.length === 0) return { ok: true, data: toEditorData(bundle) };

    const sourceHash = hashSource(source);
    const now = new Date();
    const translated = await translatePost(
      { locale: post.sourceLocale, title: source.title, excerpt: source.excerpt, contentHtml: source.contentHtml },
      targets,
    );
    await runBatch([
      ...translated.map((t) => upsertTranslation({ postId: id, ...t, isMachineTranslated: true, sourceHash, updatedAt: now })),
      db.update(posts).set({ updatedAt: now }).where(eq(posts.id, id)),
    ]);

    if (post.status === "published") invalidatePublic(post.slug);
    const fresh = await getPostBundle(id);
    return fresh ? { ok: true, data: toEditorData(fresh) } : NOT_FOUND;
  } catch (error) {
    return unexpected("retranslatePost", error);
  }
}

export async function listTags(): Promise<ActionResult<{ id: string; slug: string; names: Record<Locale, string> }[]>> {
  const denied = await unauthorized();
  if (denied) return denied;
  try {
    return { ok: true, data: await listAllTags() };
  } catch (error) {
    return unexpected("listTags", error);
  }
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect(LOGIN_PATH);
}
