/**
 * CONTRACT shared by the admin UI (editor agent) and the server actions (backend agent).
 * Server actions live in src/app/admin/actions.ts and MUST export exactly these signatures.
 */
import type { JSONContent } from "@tiptap/core";
import type { CoverImage } from "@/db/schema";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** The post's text. Posts are written (and shown) in Russian only; readers use browser translation. */
export type PostContentInput = {
  title: string;
  excerpt: string;
  contentJson: JSONContent;
};

/** A tag as the admin sees it: `name` is its (Russian) display name. */
export type TagItem = { id: string; slug: string; name: string };

export type PostEditorData = {
  id: string;
  slug: string;
  status: "draft" | "published";
  cover: CoverImage | null;
  featured: boolean;
  /** Where the story happens, e.g. «Альпы, Швейцария» (shown on the post). Null = not set. */
  location?: string | null;
  /** ISO string or null */
  publishedAt: string | null;
  updatedAt: string;
  tags: TagItem[];
  source: PostContentInput;
  /** ISO: when the "new post" email was sent — or is scheduled to go out (future). Null = never emailed. */
  newsletterSentAt?: string | null;
  /** Whether new-post emails can be sent (Brevo env vars set). Unknown (undefined) for a not-yet-saved post. */
  newsletterConfigured?: boolean;
};

export type PostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: "draft" | "published" | "scheduled";
  cover: CoverImage | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type SavePostInput = {
  id?: string; // omitted → create
  slug?: string; // omitted → generated (transliterated) from source title
  cover: CoverImage | null;
  featured: boolean;
  /** «Место», ≤ 80 chars; empty/omitted → null. */
  location?: string | null;
  /** tag display names, e.g. ["путешествия", "семья"] */
  tagNames: string[];
  /** the post's text */
  source: PostContentInput;
};

export type PublishInput = {
  id: string;
  /** ISO; omitted or in the past → publish now; future → schedule */
  publishAt?: string;
  /** Email the subscribers about this post (default true). Never sends twice for the same post. */
  notify?: boolean;
};

/** What happened to the subscriber email on publish. */
export type NewsletterOutcome = {
  status: "sent" | "scheduled" | "skipped" | "failed";
  reason?: "disabled" | "not_configured" | "already_sent" | "in_progress" | "cancelled";
  /** Russian, user-facing (failures and notes). */
  message?: string;
  /** The post's `newsletterSentAt` after the action (ISO; future = scheduled), or null. */
  newsletterSentAt: string | null;
};

export type PublishResult = {
  status: "published" | "scheduled";
  publishedAt: string;
  newsletter?: NewsletterOutcome;
};

export type UnsplashPhoto = {
  id: string;
  description: string | null;
  altDescription: string | null;
  color: string | null;
  width: number;
  height: number;
  blurHash: string | null;
  urls: { thumb: string; small: string; regular: string; full: string; raw: string };
  user: { name: string; username: string; profileUrl: string };
  /** Unsplash photo page URL (for attribution) */
  photoUrl: string;
  /** Unsplash download_location — must be pinged when the photo is selected */
  downloadLocation: string;
};

export type LanguageToolMatch = {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId: string;
  /** e.g. "misspelling" | "grammar" | "typographical" | "style" */
  issueType: string;
};
