import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  primaryKey,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { JSONContent } from "@tiptap/core";

export const postStatus = pgEnum("post_status", ["draft", "published"]);
export const localeEnum = pgEnum("locale", ["ru", "uk", "en"]);

export type CoverImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** Dominant color (hex) used as placeholder while loading. */
  color?: string;
  /** Tiny blurred preview (Unsplash blur_hash is not used; we use a small data URL or color). */
  blurDataURL?: string;
  source: "unsplash" | "upload";
  /** Required attribution for Unsplash photos. */
  credit?: {
    name: string;
    username: string;
    profileUrl: string;
    photoUrl: string;
  };
};

/**
 * A post. Shared, language-independent fields live here.
 * Status model:
 *  - draft                                  → never public
 *  - published + publishedAt <= now()       → live
 *  - published + publishedAt  > now()       → scheduled (becomes live automatically)
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** URL slug: /posts/{slug}. Latin, kebab-case. */
    slug: text("slug").notNull().unique(),
    status: postStatus("status").notNull().default("draft"),
    sourceLocale: localeEnum("source_locale").notNull().default("ru"),
    cover: jsonb("cover").$type<CoverImage | null>(),
    featured: boolean("featured").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Brevo email campaign announcing this post (null = never emailed). */
    newsletterCampaignId: integer("newsletter_campaign_id"),
    /** When the announcement email was sent, or is scheduled to be sent (future = scheduled, not sent yet). */
    newsletterSentAt: timestamp("newsletter_sent_at", { withTimezone: true }),
    /** Optional place shown in labels, e.g. "Альпы, Швейцария". */
    location: text("location"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_status_published_idx").on(t.status, t.publishedAt)],
);

/**
 * One row per (post, locale). The site is Russian-only now: only the `ru` row is written and read. The table name
 * and the per-locale shape are kept from the multilingual era (no migration); leftover uk/en rows are ignored.
 */
export const postTranslations = pgTable(
  "post_translations",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    title: text("title").notNull().default(""),
    /** Short description used in lists, meta description and OG. */
    excerpt: text("excerpt").notNull().default(""),
    /** Tiptap/ProseMirror document — source of truth for editing. */
    contentJson: jsonb("content_json").$type<JSONContent>().notNull(),
    /** Sanitized HTML rendered from contentJson at save time — what the public site renders. */
    contentHtml: text("content_html").notNull().default(""),
    /** Plain text for search & reading time. */
    plainText: text("plain_text").notNull().default(""),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    /** Legacy (multilingual era): true = produced by machine translation. Always false for new rows. */
    isMachineTranslated: boolean("is_machine_translated").notNull().default(false),
    /** Legacy (multilingual era): hash of the source text a translation was produced from. Unused now. */
    sourceHash: text("source_hash"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.locale] })],
);

/** Tags: slug is Latin; display name in `names.ru` (new tags store the same name under all three keys). */
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  names: jsonb("names").$type<{ ru: string; uk: string; en: string }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_idx").on(t.tagId)],
);

/** Failed admin login attempts, for brute-force throttling. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_ip_idx").on(t.ip, t.createdAt)],
);

/** Site-wide settings edited in the admin (key → JSON value). Keys: see src/lib/site-settings.ts. */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostTranslation = typeof postTranslations.$inferSelect;
export type Tag = typeof tags.$inferSelect;
