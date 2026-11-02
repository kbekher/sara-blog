"use client";
/** Post settings slide-over: address (slug), tags, featured, excerpt, publication date, delete. */
import { useEffect, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { listTags } from "@/app/admin/actions";
import type { Locale } from "@/lib/i18n/config";
import { Dialog } from "./dialog";
import { TagsInput } from "./tags-input";
import { LocalTime, useIsClient } from "./time";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

type Props = {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  sourceLocale: Locale;
  slug: string;
  onSlugChange: (slug: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  featured: boolean;
  onFeaturedChange: (value: boolean) => void;
  excerpt: string;
  onExcerptChange: (value: string) => void;
  status: "draft" | "published" | "scheduled";
  publishedAt: string | null;
  onOpenPublish: () => void;
  onDelete: () => void;
};

export function SettingsPanel(props: Props) {
  const {
    open,
    onClose,
    postId,
    sourceLocale,
    slug,
    onSlugChange,
    tags,
    onTagsChange,
    featured,
    onFeaturedChange,
    excerpt,
    onExcerptChange,
    status,
    publishedAt,
    onOpenPublish,
    onDelete,
  } = props;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [slugDraft, setSlugDraft] = useState(slug);
  const [lastSlug, setLastSlug] = useState(slug);
  const client = useIsClient();
  if (slug !== lastSlug) {
    setLastSlug(slug);
    setSlugDraft(slug);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listTags()
      .then((res) => {
        if (!cancelled && res.ok) setSuggestions(res.data.map((t) => t.names[sourceLocale]).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, sourceLocale]);

  const origin = client ? window.location.origin : "";
  const commitSlug = () => {
    const clean = slugify(slugDraft);
    setSlugDraft(clean);
    if (clean !== slug) onSlugChange(clean);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Настройки записи" variant="sheet">
      <div className="space-y-7 pb-4">
        <section>
          <label htmlFor="post-slug" className="admin-label">
            Адрес записи
          </label>
          <input
            id="post-slug"
            className="admin-input font-mono text-[0.9375rem]"
            value={slugDraft}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="создастся из заголовка"
            onChange={(e) => setSlugDraft(e.target.value)}
            onBlur={commitSlug}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSlug();
              }
            }}
          />
          <p className="admin-hint break-all">
            {slugDraft ? (
              <>
                {origin}/{sourceLocale}/posts/<span className="text-fg-muted">{slugify(slugDraft)}</span>
              </>
            ) : (
              "Латиницей, через дефис. Если оставить пустым — создастся автоматически из заголовка."
            )}
          </p>
        </section>

        <section>
          <label htmlFor="post-excerpt" className="admin-label">
            Краткое описание
          </label>
          <textarea
            id="post-excerpt"
            className="admin-input"
            rows={3}
            value={excerpt}
            maxLength={300}
            onChange={(e) => onExcerptChange(e.target.value.replace(/[\r\n]+/g, " "))}
            placeholder="Одно-два предложения: видно в списке записей и при отправке ссылки"
          />
          <p className="admin-hint">{excerpt.length}/300 · показывается под заголовком, в поиске и в соцсетях.</p>
        </section>

        <section>
          <TagsInput label="Теги" value={tags} onChange={onTagsChange} suggestions={suggestions} />
        </section>

        <section className="flex items-start justify-between gap-4">
          <div>
            <div id="featured-label" className="text-sm font-medium text-fg">
              Избранная запись
            </div>
            <p className="admin-hint mt-0.5">Показывается крупно на главной.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={featured}
            aria-labelledby="featured-label"
            className="admin-switch mt-0.5"
            onClick={() => onFeaturedChange(!featured)}
          />
        </section>

        <section className="rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-fg">
            <CalendarClock className="size-4 text-fg-subtle" aria-hidden />
            Публикация
          </div>
          <p className="mt-1.5 text-sm text-fg-muted">
            {status === "draft" ? (
              "Черновик — пока виден только вам."
            ) : status === "scheduled" && publishedAt ? (
              <>
                Запланирована на <LocalTime iso={publishedAt} />.
              </>
            ) : publishedAt ? (
              <>
                Опубликована <LocalTime iso={publishedAt} />.
              </>
            ) : (
              "Опубликована."
            )}
          </p>
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm mt-3" onClick={onOpenPublish}>
            {status === "draft" ? "Опубликовать или запланировать…" : "Изменить дату публикации…"}
          </button>
        </section>

        {postId ? (
          <section className="border-t border-border pt-6">
            <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden />
              Удалить запись
            </button>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
