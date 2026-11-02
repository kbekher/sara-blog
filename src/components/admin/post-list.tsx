"use client";
/** Dashboard list with status filters and quick actions. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Pencil, ExternalLink, Trash2, Plus, FileText, ImageIcon } from "lucide-react";
import { clsx } from "clsx";
import type { PostListItem } from "@/lib/admin/types";
import { deletePost } from "@/app/admin/actions";
import { useToast } from "./toast";
import { ConfirmDialog } from "./dialog";
import { LocalTime } from "./time";

type Filter = "all" | "draft" | "scheduled" | "published";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "draft", label: "Черновики" },
  { id: "scheduled", label: "Запланированные" },
  { id: "published", label: "Опубликованные" },
];

const STATUS: Record<PostListItem["status"], { label: string; tone?: "green" | "amber" | "blue" }> = {
  draft: { label: "Черновик" },
  scheduled: { label: "Запланирована", tone: "blue" },
  published: { label: "Опубликована", tone: "green" },
};

export function PostList({ posts: initialPosts }: { posts: PostListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [posts, setPosts] = useState(initialPosts);
  const [filter, setFilter] = useState<Filter>("all");
  const [toDelete, setToDelete] = useState<PostListItem | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: posts.length, draft: 0, scheduled: 0, published: 0 };
    posts.forEach((p) => c[p.status]++);
    return c;
  }, [posts]);
  const visible = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      const res = await deletePost(toDelete.id);
      if (!res.ok) {
        toast.error("Не удалось удалить", { description: res.error });
        return;
      }
      setPosts((list) => list.filter((p) => p.id !== toDelete.id));
      toast.success("Запись удалена");
      setToDelete(null);
      router.refresh();
    } catch {
      toast.error("Не удалось удалить", { description: "Нет связи с сервером." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div role="tablist" aria-label="Фильтр записей" className="admin-scroll-x -mx-4 mb-6 flex gap-1 px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors",
              filter === f.id ? "bg-surface-hover text-fg-strong" : "text-fg-muted hover:text-fg",
            )}
          >
            {f.label}
            <span className="ml-1.5 text-fg-subtle tabular-nums">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
          <FileText className="mx-auto size-8 text-fg-subtle" aria-hidden />
          <p className="mt-4 font-serif text-xl text-fg-strong">
            {filter === "all" ? "Здесь появятся ваши записи" : "В этом разделе пока пусто"}
          </p>
          {filter === "all" ? (
            <Link href="/admin/posts/new" className="admin-btn admin-btn-primary mt-6">
              <Plus className="size-4" aria-hidden />
              Написать первую запись
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {visible.map((p) => {
            const status = STATUS[p.status];
            return (
              <li key={p.id} className="group relative flex items-center gap-4 py-4">
                <div className="relative hidden aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl bg-surface sm:block" style={{ backgroundColor: p.cover?.color }}>
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail of a remote cover
                    <img src={p.cover.url} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="absolute inset-0 m-auto size-5 text-fg-subtle" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/posts/${p.id}`}
                    className="line-clamp-2 font-serif text-lg leading-snug font-semibold text-fg-strong after:absolute after:inset-0 hover:text-accent"
                  >
                    {p.title || "Без заголовка"}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-fg-subtle">
                    <span className="admin-badge" data-tone={status.tone}>
                      {status.label}
                    </span>
                    <span>
                      {p.status === "draft" ? (
                        <>
                          изменена <LocalTime iso={p.updatedAt} options={{ year: undefined }} />
                        </>
                      ) : p.publishedAt ? (
                        <LocalTime iso={p.publishedAt} options={{ hour: undefined, minute: undefined }} />
                      ) : null}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <Link href={`/admin/posts/${p.id}`} className="admin-icon-btn" aria-label={`Редактировать «${p.title || "Без заголовка"}»`}>
                    <Pencil className="size-4" aria-hidden />
                  </Link>
                  {p.status === "published" ? (
                    <a
                      href={`/posts/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-icon-btn"
                      aria-label={`Открыть «${p.title}» на сайте`}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  ) : null}
                  <button type="button" className="admin-icon-btn hover:!text-[var(--tc-red)]" onClick={() => setToDelete(p)} aria-label={`Удалить «${p.title || "Без заголовка"}»`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Удалить запись навсегда?"
        description={toDelete ? `«${toDelete.title || "Без заголовка"}». Это нельзя отменить.` : undefined}
        confirmLabel="Удалить"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
