/**
 * CONTRACT shared by the admin UI (editor agent) and the server actions (backend agent).
 * Server actions live in src/app/admin/actions.ts and MUST export exactly these signatures.
 */
import type { JSONContent } from "@tiptap/core";
import type { CoverImage } from "@/db/schema";
import type { Locale } from "@/lib/i18n/config";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type TranslationInput = {
  title: string;
  excerpt: string;
  contentJson: JSONContent;
};

export type PostEditorData = {
  id: string;
  slug: string;
  status: "draft" | "published";
  sourceLocale: Locale;
  cover: CoverImage | null;
  featured: boolean;
  /** ISO string or null */
  publishedAt: string | null;
  updatedAt: string;
  tags: { id: string; slug: string; names: Record<Locale, string> }[];
  translations: Partial<
    Record<
      Locale,
      TranslationInput & {
        isMachineTranslated: boolean;
        /** true when the source changed after this translation was produced */
        isStale: boolean;
        updatedAt: string;
      }
    >
  >;
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
  /** locales that exist & are not stale */
  locales: Locale[];
};

export type SavePostInput = {
  id?: string; // omitted → create
  slug?: string; // omitted → generated (transliterated) from source title
  cover: CoverImage | null;
  featured: boolean;
  /** tag display names in the source locale, e.g. ["путешествия", "семья"] */
  tagNames: string[];
  /** source-locale content */
  source: TranslationInput;
  /** optional hand-edited translations for other locales (marks them not machine-translated) */
  translations?: Partial<Record<Locale, TranslationInput>>;
};

export type PublishInput = {
  id: string;
  /** ISO; omitted or in the past → publish now; future → schedule */
  publishAt?: string;
  /** default true: (re)translate missing/stale locales with DeepL before publishing */
  translate?: boolean;
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
