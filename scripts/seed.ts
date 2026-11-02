/**
 * Inserts one sample published post ("Привет, мир") with a few formatting features.
 * Idempotent: does nothing if slug "privet-mir" exists.
 *
 *   pnpm db:seed
 *
 * Runs with `--conditions=react-server` (see package.json) so `server-only` imports resolve to no-ops.
 */
import "./load-env";
import { randomUUID } from "node:crypto";
import type { JSONContent } from "@tiptap/core";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { postTags, posts } from "@/db/schema";
import { renderContent } from "@/lib/content";
import { siteLocale } from "@/lib/i18n/config";
import { normalizeTagNames, resolveTagIds, runBatch, upsertPostText } from "@/lib/posts/admin-queries";

const SLUG = "privet-mir";

const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text: value, ...(marks && { marks }) });
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });

const doc: JSONContent = {
  type: "doc",
  content: [
    p(
      text("Это первый пост в блоге. Здесь я буду писать о "),
      text("разных сторонах жизни", [{ type: "italic" }]),
      text(" — и о том очень необычном опыте, который мне довелось прожить."),
    ),
    { type: "heading", attrs: { level: 2 }, content: [text("Зачем этот блог")] },
    p(
      text("Иногда мысль становится ясной, только когда её записываешь. "),
      text("Этот блог — место для таких мыслей", [{ type: "bold" }]),
      text(", "),
      text("наблюдений", [{ type: "highlight", attrs: { color: "yellow" } }]),
      text(" и "),
      text("историй", [{ type: "textColor", attrs: { color: "orange" } }]),
      text("."),
    ),
    {
      type: "blockquote",
      content: [p(text("Жизнь можно понять, только оглядываясь назад, но прожить — только глядя вперёд."))],
    },
    { type: "heading", attrs: { level: 3 }, content: [text("О чём здесь будет")] },
    {
      type: "bulletList",
      content: ["Личный опыт и выводы из него", "Книги, люди и места", "Вопросы без готовых ответов"].map((item) => ({
        type: "listItem",
        content: [p(text(item))],
      })),
    },
    p(
      text("Подписывайтесь на рассылку или "),
      text("RSS", [{ type: "link", attrs: { href: "/rss.xml" } }]),
      text(", чтобы не пропустить новые записи. Спасибо, что читаете!"),
    ),
  ],
};

async function main() {
  const [existing] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, SLUG)).limit(1);
  if (existing) {
    console.log(`✔ Sample post "${SLUG}" already exists — nothing to do.`);
    return;
  }

  const id = randomUUID();
  const now = new Date();
  const title = "Привет, мир";
  const excerpt = "Первая запись: зачем этот блог и о чём я собираюсь здесь писать.";
  const rendered = renderContent(doc);

  const tagIds = await resolveTagIds(normalizeTagNames(["о блоге", "жизнь"]));

  await runBatch([
    db.insert(posts).values({
      id,
      slug: SLUG,
      status: "published",
      sourceLocale: siteLocale,
      cover: null,
      featured: true,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
    upsertPostText({
      postId: id,
      title,
      excerpt,
      contentJson: rendered.json,
      contentHtml: rendered.html,
      plainText: rendered.plainText,
      readingMinutes: rendered.readingMinutes,
      updatedAt: now,
    }),
    ...(tagIds.length > 0 ? [db.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId })))] : []),
  ]);

  console.log(`✔ Seeded "${title}" → /posts/${SLUG}`);
}

main().catch((error) => {
  console.error("✖ Seed failed:", error);
  process.exit(1);
});
