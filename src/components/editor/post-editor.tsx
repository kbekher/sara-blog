"use client";
/**
 * The post editor page: header (save status, preview, settings, publish), cover, title, subtitle
 * and the Tiptap body (dynamically imported, client-only). Posts are written in Russian only — readers use
 * their browser's translation — so spellcheck, typography and LanguageTool always run in Russian.
 *
 * Data flow
 *  - All editable data lives in one `data` object mirrored in `dataRef` (so save() always sees the latest).
 *  - The body editor's JSON is pulled lazily (`flushBody`) when saving or previewing.
 *  - Autosave: 2 s after the last change, on blur, on tab hide and on Cmd/Ctrl+S; saves are serialized.
 *    A version counter detects edits made while a save was in flight.
 *  - A localStorage backup is written ~0.6 s after each change and offered back on load if it is newer
 *    than the server copy.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/react";
import {
  ArrowLeft,
  Eye,
  Settings2,
  Send,
  RefreshCw,
  MoreHorizontal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  History,
  ExternalLink,
} from "lucide-react";
import type { CoverImage } from "@/db/schema";
import type { PostContentInput, PostEditorData, PublishResult, SavePostInput } from "@/lib/admin/types";
import { siteLocale } from "@/lib/i18n/config";
import { typographText } from "@/lib/content/typography";
import { deletePost, publishPost, savePost, unpublishPost } from "@/app/admin/actions";
import { useToast } from "@/components/admin/toast";
import { ConfirmDialog, Dialog } from "@/components/admin/dialog";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { PublishDialog } from "@/components/admin/publish-dialog";
import { formatDateTime, formatTime, useNow } from "@/components/admin/time";
import { Popover } from "./popover";
import { TitleField } from "./title-field";
import { CoverArea } from "./cover-area";
import { readLocalDraft, removeLocalDraft, writeLocalDraft, type LocalDraft, type LocalDraftData } from "./local-draft";
import "./editor.css";

const BodyEditor = dynamic(() => import("./body-editor"), {
  ssr: false,
  loading: () => <BodyLoading />,
});

function BodyLoading() {
  return (
    <div aria-hidden className="space-y-4 pt-20">
      <div className="admin-skeleton h-5 w-11/12" />
      <div className="admin-skeleton h-5 w-full" />
      <div className="admin-skeleton h-5 w-4/5" />
    </div>
  );
}

/* ───────────────────────── Types & helpers ───────────────────────── */

type Draft = PostContentInput;

type Data = {
  postId: string | null;
  slug: string;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string | null;
  newsletterSentAt: string | null;
  newsletterConfigured: boolean | undefined;
  cover: CoverImage | null;
  featured: boolean;
  location: string;
  tagNames: string[];
  draft: Draft;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
const AUTOSAVE_MS = 2000;
const BACKUP_MS = 600;

function emptyDraft(): Draft {
  return { title: "", excerpt: "", contentJson: EMPTY_DOC };
}

function docHasContent(doc: JSONContent | undefined): boolean {
  if (!doc) return false;
  if (doc.type === "text") return !!doc.text?.trim();
  if (doc.type === "image" || doc.type === "horizontalRule") return true;
  return (doc.content ?? []).some(docHasContent);
}

function draftHasContent(d: Draft | undefined): boolean {
  return !!d && (!!d.title.trim() || !!d.excerpt.trim() || docHasContent(d.contentJson));
}

function fromInitial(initial: PostEditorData | null): Data {
  const source = initial?.source;
  return {
    postId: initial?.id ?? null,
    slug: initial?.slug ?? "",
    status: initial?.status ?? "draft",
    publishedAt: initial?.publishedAt ?? null,
    updatedAt: initial?.updatedAt ?? null,
    newsletterSentAt: initial?.newsletterSentAt ?? null,
    newsletterConfigured: initial?.newsletterConfigured,
    cover: initial?.cover ?? null,
    featured: initial?.featured ?? false,
    location: initial?.location ?? "",
    tagNames: initial?.tags.map((t) => t.name).filter(Boolean) ?? [],
    draft: source
      ? { title: source.title, excerpt: source.excerpt, contentJson: source.contentJson ?? EMPTY_DOC }
      : emptyDraft(),
  };
}

function backupPayload(d: Data): LocalDraftData {
  return { slug: d.slug, cover: d.cover, featured: d.featured, location: d.location, tagNames: d.tagNames, draft: d.draft };
}

function samePayload(a: LocalDraftData, b: LocalDraftData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ───────────────────────── Component ───────────────────────── */

export function PostEditor({ initial }: { initial: PostEditorData | null }) {
  const router = useRouter();
  const toast = useToast();
  const now = useNow();

  const [data, setData] = useState<Data>(() => fromInitial(initial));
  const dataRef = useRef(data);
  const update = useCallback((fn: (d: Data) => Data) => {
    dataRef.current = fn(dataRef.current);
    setData(dataRef.current);
  }, []);

  const [editorKey, setEditorKey] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>(initial ? { kind: "saved", at: 0 } : { kind: "idle" });
  const [busy, setBusy] = useState<null | "publish" | "update" | "unpublish" | "delete">(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [preview, setPreview] = useState<{ html: string } | null>(null);
  const [confirm, setConfirm] = useState<null | "unpublish" | "delete">(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [restore, setRestore] = useState<LocalDraft | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const versionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  /** latest `save` (declared below) for timers and listeners */
  const saveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  const { draft } = data;
  const isScheduled = data.status === "published" && !!data.publishedAt && now > 0 && Date.parse(data.publishedAt) > now;
  const displayStatus: "draft" | "published" | "scheduled" = data.status === "draft" ? "draft" : isScheduled ? "scheduled" : "published";

  /* ── body sync ── */
  const flushBody = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const json = editor.getJSON();
    const current = dataRef.current.draft;
    if (current.contentJson === json) return;
    dataRef.current = { ...dataRef.current, draft: { ...current, contentJson: json } };
    // No re-render needed: content is only read on (re)mount of the body editor.
  }, []);

  /* ── saving ── */
  const runSave = useCallback(async (): Promise<boolean> => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    flushBody();
    const d = dataRef.current;
    const source = d.draft;
    const startVersion = versionRef.current;
    if (!d.postId && !draftHasContent(source) && !d.cover) {
      savedVersionRef.current = startVersion;
      setSaveState({ kind: "idle" });
      return true;
    }
    setSaveState({ kind: "saving" });
    const input: SavePostInput = {
      id: d.postId ?? undefined,
      slug: d.slug.trim() || undefined,
      cover: d.cover,
      featured: d.featured,
      location: d.location.trim() || null,
      tagNames: d.tagNames,
      source,
    };
    let res: Awaited<ReturnType<typeof savePost>>;
    try {
      // ProseMirror attrs are not plain objects (null prototype); React would send them as
      // temporary client references the server can't read. A JSON round-trip makes them plain.
      res = await savePost(JSON.parse(JSON.stringify(input)) as SavePostInput);
    } catch {
      res = { ok: false, error: "Нет связи с сервером" };
    }
    if (!res.ok) {
      lastErrorRef.current = res.error;
      setSaveState({ kind: "error", message: res.error });
      return false;
    }
    const { id, slug, updatedAt } = res.data;
    const wasNew = !d.postId;
    savedVersionRef.current = startVersion;
    update((cur) => ({ ...cur, postId: id, slug, updatedAt }));
    if (wasNew) {
      // Keep the editor mounted (no navigation): just give the page its real URL.
      window.history.replaceState(null, "", `/admin/posts/${id}`);
      removeLocalDraft(null);
    }
    if (versionRef.current === startVersion) {
      setSaveState({ kind: "saved", at: Date.now() });
      removeLocalDraft(id);
    } else {
      setSaveState({ kind: "dirty" });
      autosaveTimer.current = setTimeout(() => void saveRef.current(), AUTOSAVE_MS);
    }
    return true;
  }, [flushBody, update]);

  /** Serialized save; resolves true when everything up to now is stored. */
  const save = useCallback((): Promise<boolean> => {
    chainRef.current = chainRef.current.then(() =>
      versionRef.current === savedVersionRef.current && dataRef.current.postId ? true : runSave(),
    );
    return chainRef.current;
  }, [runSave]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const writeBackup = useCallback(() => {
    flushBody();
    writeLocalDraft(dataRef.current.postId, backupPayload(dataRef.current));
  }, [flushBody]);

  const markDirty = useCallback(
    () => {
      versionRef.current++;
      setSaveState((s) => (s.kind === "dirty" || s.kind === "saving" ? s : { kind: "dirty" }));
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => void saveRef.current(), AUTOSAVE_MS);
      if (backupTimer.current) clearTimeout(backupTimer.current);
      backupTimer.current = setTimeout(writeBackup, BACKUP_MS);
    },
    [writeBackup],
  );

  /* ── lifecycle: restore offer, unload guard, Cmd+S, tab hide, focus mode ── */
  useEffect(() => {
    const t = setTimeout(() => {
      const backup = readLocalDraft(initial?.id ?? null);
      if (!backup) return;
      const current = backupPayload(dataRef.current);
      const newer = !initial || Date.parse(backup.savedAt) > Date.parse(initial.updatedAt);
      const meaningful = draftHasContent(backup.data.draft) || !!backup.data.cover;
      if (newer && meaningful && !samePayload(backup.data, current)) setRestore(backup);
      else removeLocalDraft(initial?.id ?? null);
    }, 0);
    return () => clearTimeout(t);
  }, [initial]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (versionRef.current !== savedVersionRef.current) {
        writeBackup();
        e.preventDefault();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && versionRef.current !== savedVersionRef.current) {
        writeBackup();
        void saveRef.current();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [writeBackup]);

  useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (backupTimer.current) clearTimeout(backupTimer.current);
    },
    [],
  );

  // Focus mode: chrome fades while typing (fine pointers only), returns when the mouse moves.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let last: { x: number; y: number } | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      const target = e.target as HTMLElement;
      if (target.closest(".ProseMirror, .editor-title, .editor-excerpt")) root.dataset.typing = "true";
    };
    const onMove = (e: MouseEvent) => {
      if (last && Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y) > 6) root.dataset.typing = "false";
      last = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousemove", onMove);
    };
  }, []);

  /* ── field handlers ── */
  const setDraftField = (field: "title" | "excerpt", value: string) => {
    update((cur) => ({ ...cur, draft: { ...cur.draft, [field]: value } }));
    markDirty();
  };

  /**
   * Smart typography for title/subtitle on blur (the body gets it live via input rules): quotes, dashes,
   * ellipsis, no-break spaces — Russian rules. Capitalization is left to the author. Only writes on change.
   */
  const typographField = (field: "title" | "excerpt") => {
    const current = dataRef.current.draft[field];
    if (!current) return;
    const next = typographText(current, siteLocale, { capitalize: false });
    if (next !== current) setDraftField(field, next);
  };

  const onBodyChange = useCallback(() => markDirty(), [markDirty]);
  const onBodyReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);
  const onBodyBlur = useCallback(() => {
    if (versionRef.current !== savedVersionRef.current) void saveRef.current();
  }, []);
  const onSaveShortcut = useCallback(() => void saveRef.current(), []);

  /* ── actions ── */
  const publicLinks = (slug: string) => [{ label: "Открыть на сайте ↗", href: `/posts/${slug}` }];

  const ensureSaved = async (): Promise<string | null> => {
    const ok = await save();
    const id = dataRef.current.postId;
    if (!ok || !id) {
      toast.error("Не удалось сохранить", {
        description: !ok && lastErrorRef.current ? lastErrorRef.current : "Добавьте заголовок или текст и попробуйте ещё раз.",
      });
      return null;
    }
    return id;
  };

  const newsletterToast = (outcome: PublishResult["newsletter"]) => {
    if (!outcome) return;
    if (outcome.status === "failed") {
      toast.error("Письмо подписчикам не отправлено", { description: outcome.message, duration: 0 });
    } else if (outcome.reason === "not_configured") {
      toast.info("Письмо не отправлено", { description: "Рассылка не настроена (см. /api/newsletter/check)." });
    } else if (outcome.reason === "cancelled") {
      toast.info("Письмо подписчикам отменено", { description: outcome.message });
    }
  };

  const newsletterLine = (outcome: PublishResult["newsletter"]): string => {
    if (outcome?.status === "sent") return " Письмо подписчикам отправлено.";
    if (outcome?.status === "scheduled" && outcome.newsletterSentAt) {
      return ` Письмо подписчикам уйдёт ${formatDateTime(outcome.newsletterSentAt)}.`;
    }
    return "";
  };

  const handlePublish = async ({ publishAt, notify }: { publishAt?: string; notify: boolean }) => {
    setBusy("publish");
    try {
      const id = await ensureSaved();
      if (!id) return;
      const res = await publishPost({ id, publishAt, notify });
      if (!res.ok) {
        toast.error("Не удалось опубликовать", { description: res.error });
        return;
      }
      const newsletter = res.data.newsletter;
      update((cur) => ({
        ...cur,
        status: "published",
        publishedAt: res.data.publishedAt,
        ...(newsletter && {
          newsletterSentAt: newsletter.newsletterSentAt,
          ...(newsletter.reason === "not_configured" && { newsletterConfigured: false }),
        }),
      }));
      setPublishOpen(false);
      const slug = dataRef.current.slug;
      if (res.data.status === "scheduled") {
        toast.success("Запись запланирована", {
          description: `Появится ${formatDateTime(res.data.publishedAt)}.${newsletterLine(newsletter)}`,
        });
      } else {
        toast.success("Опубликовано! 🎉", { description: `Запись уже на сайте.${newsletterLine(newsletter)}`, links: publicLinks(slug) });
      }
      newsletterToast(newsletter);
    } catch {
      toast.error("Не удалось опубликовать", { description: "Нет связи с сервером. Попробуйте ещё раз." });
    } finally {
      setBusy(null);
    }
  };

  const handleUpdate = async () => {
    setBusy("update");
    try {
      // Saving a published post refreshes the public pages (the save action invalidates their cache).
      const id = await ensureSaved();
      if (!id) return;
      toast.success("Изменения опубликованы", {
        links: isScheduled ? undefined : publicLinks(dataRef.current.slug),
      });
    } catch {
      toast.error("Не удалось обновить", { description: "Нет связи с сервером." });
    } finally {
      setBusy(null);
    }
  };

  const handleUnpublish = async () => {
    const id = dataRef.current.postId;
    if (!id) return;
    setBusy("unpublish");
    try {
      const res = await unpublishPost(id);
      if (!res.ok) {
        toast.error("Не удалось снять с публикации", { description: res.error });
        return;
      }
      // The server cancels a scheduled (not yet sent) subscriber email on unpublish.
      update((cur) => ({
        ...cur,
        status: "draft",
        newsletterSentAt: cur.newsletterSentAt && Date.parse(cur.newsletterSentAt) > Date.now() ? null : cur.newsletterSentAt,
      }));
      setConfirm(null);
      toast.success("Запись снята с публикации", { description: "Теперь она снова черновик и не видна читателям." });
    } catch {
      toast.error("Не удалось снять с публикации", { description: "Нет связи с сервером." });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    const id = dataRef.current.postId;
    if (!id) return;
    setBusy("delete");
    try {
      const res = await deletePost(id);
      if (!res.ok) {
        toast.error("Не удалось удалить", { description: res.error });
        return;
      }
      savedVersionRef.current = versionRef.current; // nothing left to save
      removeLocalDraft(id);
      toast.success("Запись удалена");
      router.push("/admin");
    } catch {
      toast.error("Не удалось удалить", { description: "Нет связи с сервером." });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const openPreview = () => {
    flushBody();
    setPreview({ html: editorRef.current?.getHTML() ?? "" });
  };

  const applyRestore = () => {
    if (!restore) return;
    const b = restore.data;
    update((cur) => ({
      ...cur,
      slug: b.slug,
      cover: b.cover,
      featured: b.featured,
      location: b.location,
      tagNames: b.tagNames,
      draft: b.draft,
    }));
    setRestore(null);
    setEditorKey((k) => k + 1);
    markDirty();
    toast.success("Несохранённая версия восстановлена");
  };

  /* ── derived UI ── */
  const saveLabel = useMemo(() => {
    switch (saveState.kind) {
      case "idle":
        return { text: "Черновик", icon: null };
      case "dirty":
        return { text: "Есть изменения", icon: null };
      case "saving":
        return { text: "Сохранение…", icon: <Loader2 className="size-3.5 animate-spin" aria-hidden /> };
      case "saved":
        return {
          text: saveState.at ? `Сохранено · ${formatTime(new Date(saveState.at))}` : "Сохранено",
          icon: <CheckCircle2 className="size-3.5 text-[var(--tc-green)]" aria-hidden />,
        };
      case "error":
        return { text: "Ошибка — повторить", icon: <AlertCircle className="size-3.5" aria-hidden /> };
    }
  }, [saveState]);

  const saveStatus =
    saveState.kind === "error" ? (
      <button
        type="button"
        onClick={() => void save()}
        className="inline-flex items-center gap-1.5 text-[var(--tc-red)] hover:underline"
        title={saveState.message}
        aria-label={`Ошибка сохранения: ${saveState.message}. Повторить`}
      >
        {saveLabel.icon}
        {saveLabel.text}
      </button>
    ) : (
      <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite">
        {saveLabel.icon}
        {saveLabel.text}
      </span>
    );

  const title = draft.title;

  return (
    <div ref={rootRef} className="min-h-dvh" data-typing="false">
      {/* ── Header ── */}
      <header className="editor-header">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-1.5 px-3 sm:gap-2 sm:px-5">
          <Link href="/admin" className="admin-icon-btn" aria-label="Все записи" title="Все записи">
            <ArrowLeft className="size-[18px]" aria-hidden />
          </Link>

          <div className="ml-auto hidden text-xs text-fg-subtle md:block">{saveStatus}</div>

          <button type="button" className="admin-icon-btn" onClick={openPreview} aria-label="Предпросмотр" title="Предпросмотр">
            <Eye className="size-[18px]" aria-hidden />
          </button>
          <button type="button" className="admin-icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Настройки записи" title="Настройки записи">
            <Settings2 className="size-[18px]" aria-hidden />
          </button>

          {data.status === "draft" ? (
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm ml-1 md:ml-1 max-md:ml-auto" onClick={() => setPublishOpen(true)} disabled={!!busy}>
              <Send className="size-4" aria-hidden />
              <span className="hidden sm:inline">Опубликовать</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="admin-btn admin-btn-primary admin-btn-sm ml-1"
                onClick={() => void handleUpdate()}
                disabled={!!busy}
                aria-label="Сохранить и обновить опубликованную запись"
              >
                {busy === "update" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                <span className="hidden sm:inline">Обновить</span>
              </button>
              <button
                ref={moreRef}
                type="button"
                className="admin-icon-btn"
                aria-label="Ещё действия"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <MoreHorizontal className="size-[18px]" aria-hidden />
              </button>
              <Popover open={moreOpen} onClose={() => setMoreOpen(false)} anchorRef={moreRef} placement="bottom-end" label="Ещё действия" className="editor-menu w-64">
                {!isScheduled && data.slug ? (
                  <a className="editor-menu-item text-sm" href={`/posts/${data.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 text-fg-subtle" aria-hidden />
                    Открыть на сайте
                  </a>
                ) : null}
                <button
                  type="button"
                  className="editor-menu-item text-sm"
                  onClick={() => {
                    setMoreOpen(false);
                    setPublishOpen(true);
                  }}
                >
                  <History className="size-4 text-fg-subtle" aria-hidden />
                  {isScheduled ? "Изменить время / опубликовать сейчас" : "Изменить дату публикации"}
                </button>
                <button
                  type="button"
                  className="editor-menu-item text-sm text-[var(--tc-red)]"
                  onClick={() => {
                    setMoreOpen(false);
                    setConfirm("unpublish");
                  }}
                >
                  <AlertCircle className="size-4" aria-hidden />
                  Снять с публикации
                </button>
              </Popover>
            </>
          )}
        </div>
      </header>

      <main className="editor-column pt-6 pb-0 sm:pt-10">
        {restore ? (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--tc-orange)_40%,transparent)] bg-[color-mix(in_srgb,var(--tc-orange)_8%,transparent)] p-4 text-sm sm:flex-row sm:items-center">
            <History className="size-5 shrink-0 text-[var(--tc-orange)]" aria-hidden />
            <div className="flex-1 text-fg">
              Восстановить несохранённую версию от {formatDateTime(restore.savedAt, { year: undefined })}?
              <span className="block text-fg-muted">Она осталась в этом браузере, но не успела сохраниться на сервере.</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => {
                  removeLocalDraft(data.postId);
                  setRestore(null);
                }}
              >
                Не нужно
              </button>
              <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={applyRestore}>
                Восстановить
              </button>
            </div>
          </div>
        ) : null}

        <div className="mb-8">
          <CoverArea
            cover={data.cover}
            title={title}
            onChange={(cover) => {
              update((cur) => ({ ...cur, cover }));
              markDirty();
            }}
          />
        </div>

        <TitleField
          variant="title"
          value={title}
          label="Заголовок"
          placeholder="Заголовок"
          maxLength={200}
          onChange={(v) => setDraftField("title", v)}
          onEnter={() => excerptRef.current?.focus()}
          onBlur={() => {
            typographField("title");
            onBodyBlur();
          }}
        />
        <TitleField
          ref={excerptRef}
          variant="excerpt"
          value={draft.excerpt}
          label="Подзаголовок"
          placeholder="Подзаголовок — одна-две фразы о чём эта история"
          maxLength={300}
          onChange={(v) => setDraftField("excerpt", v)}
          onEnter={() => editorRef.current?.commands.focus("start")}
          onBlur={() => {
            typographField("excerpt");
            onBodyBlur();
          }}
        />

        <BodyEditor
          key={editorKey}
          initialContent={draft.contentJson}
          onChange={onBodyChange}
          onReady={onBodyReady}
          onSaveShortcut={onSaveShortcut}
          onBlur={onBodyBlur}
          title={title}
          saveStatus={saveStatus}
        />
      </main>

      {/* ── Dialogs ── */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        postId={data.postId}
        slug={data.slug}
        onSlugChange={(slug) => {
          update((cur) => ({ ...cur, slug }));
          markDirty();
        }}
        tags={data.tagNames}
        onTagsChange={(tagNames) => {
          update((cur) => ({ ...cur, tagNames }));
          markDirty();
        }}
        featured={data.featured}
        onFeaturedChange={(featured) => {
          update((cur) => ({ ...cur, featured }));
          markDirty();
        }}
        location={data.location}
        onLocationChange={(location) => {
          update((cur) => ({ ...cur, location }));
          markDirty();
        }}
        excerpt={draft.excerpt}
        onExcerptChange={(v) => setDraftField("excerpt", v)}
        status={displayStatus}
        publishedAt={data.publishedAt}
        onOpenPublish={() => {
          setSettingsOpen(false);
          setPublishOpen(true);
        }}
        onDelete={() => {
          setSettingsOpen(false);
          setConfirm("delete");
        }}
      />

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        status={displayStatus}
        publishedAt={data.publishedAt}
        newsletterSentAt={data.newsletterSentAt}
        newsletterConfigured={data.newsletterConfigured}
        busy={busy === "publish"}
        onPublish={(input) => void handlePublish(input)}
      />

      <Dialog open={!!preview} onClose={() => setPreview(null)} title="Предпросмотр" size="lg" bodyClassName="px-5 sm:px-10">
        {preview ? (
          <article className="mx-auto max-w-[44rem] pb-10">
            {data.cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview of an arbitrary remote cover
              <img src={data.cover.url} alt={data.cover.alt} className="mb-8 w-full rounded-2xl" />
            ) : null}
            <h1 className="font-serif text-4xl leading-tight font-semibold text-balance text-fg-strong">{title || "Без заголовка"}</h1>
            {draft.excerpt ? <p className="mt-3 font-serif text-xl text-fg-muted italic">{draft.excerpt}</p> : null}
            <div className="prose-sara mt-8" dangerouslySetInnerHTML={{ __html: preview.html }} />
            {data.status === "published" && !isScheduled && data.slug ? (
              <a href={`/posts/${data.slug}`} target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-secondary mt-10">
                <ExternalLink className="size-4" aria-hidden />
                Открыть на сайте
              </a>
            ) : null}
          </article>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm === "unpublish"}
        title="Снять запись с публикации?"
        description="Она перестанет быть видна читателям и снова станет черновиком."
        confirmLabel="Снять с публикации"
        danger
        busy={busy === "unpublish"}
        onConfirm={() => void handleUnpublish()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Удалить запись навсегда?"
        description="Это нельзя отменить."
        confirmLabel="Удалить"
        danger
        busy={busy === "delete"}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
