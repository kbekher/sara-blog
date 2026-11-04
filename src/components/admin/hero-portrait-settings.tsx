"use client";
/**
 * «Фото на главной»: the tall portrait in the home hero. Pick (upload or Unsplash) → describe (alt, required)
 * → «Сохранить». Removing asks for confirmation and saves immediately.
 */
import { useRef, useState } from "react";
import { AlertTriangle, ImageOff, Images, Loader2, Trash2, Upload } from "lucide-react";
import type { CoverImage } from "@/db/schema";
import { saveHeroPortrait } from "@/app/admin/actions";
import { site } from "@/lib/site";
import { UnsplashPicker } from "@/components/editor/unsplash-picker";
import { ACCEPTED_IMAGE_ACCEPT, uploadImage, validateImage } from "@/components/editor/upload";
import { ConfirmDialog } from "./dialog";
import { useToast } from "./toast";

const ALT_MAX = 300;

function samePortrait(a: CoverImage | null, b: CoverImage | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function HeroPortraitSettings({ initial }: { initial: CoverImage | null }) {
  const toast = useToast();
  const [saved, setSaved] = useState<CoverImage | null>(initial);
  const [draft, setDraft] = useState<CoverImage | null>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = !samePortrait(saved, draft);
  const alt = draft?.alt ?? "";

  const upload = async (file: File) => {
    const problem = validateImage(file);
    if (problem) {
      toast.error("Фото не загружено", { description: problem });
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setProgress(0);
    try {
      const { url, width, height } = await uploadImage(file, { onProgress: setProgress });
      setDraft({ url, alt: draft?.source === "upload" ? alt : "", width: width ?? undefined, height: height ?? undefined, source: "upload" });
      setAltError(null);
    } catch (error) {
      toast.error("Фото не загружено", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setProgress(null);
      setPreview(null);
      setTimeout(() => URL.revokeObjectURL(local), 2000);
    }
  };

  const persist = async (value: CoverImage | null): Promise<boolean> => {
    setBusy(true);
    try {
      const payload = value ? ({ ...value, alt: value.alt.replace(/\s+/g, " ").trim() } satisfies CoverImage) : null;
      const res = await saveHeroPortrait(payload).catch(() => ({ ok: false as const, error: "Нет связи с сервером" }));
      if (!res.ok) {
        const fieldErrors = "fieldErrors" in res ? res.fieldErrors : undefined;
        if (fieldErrors?.alt) setAltError(fieldErrors.alt);
        toast.error("Не удалось сохранить", { description: res.error });
        return false;
      }
      setSaved(res.data.heroPortrait);
      setDraft(res.data.heroPortrait);
      setAltError(null);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (draft && !alt.trim()) {
      setAltError("Добавьте описание фото — его прочитают незрячие читатели.");
      return;
    }
    if (await persist(draft)) toast.success("Фото на главной обновлено");
  };

  const remove = async () => {
    setConfirmRemove(false);
    if (!saved) {
      setDraft(null);
      return;
    }
    if (await persist(null)) toast.success("Фото убрано с главной");
  };

  return (
    <section aria-labelledby="hero-portrait-title" className="rounded-3xl border border-border p-5 sm:p-7">
      <h2 id="hero-portrait-title" className="font-serif text-2xl font-semibold text-fg-strong">
        Фото на главной
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        Портрет в шапке главной страницы. Вертикальное фото смотрится лучше всего (3:4).
      </p>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div
          className="relative aspect-[3/4] w-full max-w-[16rem] shrink-0 overflow-hidden rounded-2xl bg-surface"
          style={draft?.color ? { backgroundColor: draft.color } : undefined}
          aria-busy={progress !== null}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
            if (file) {
              e.preventDefault();
              void upload(file);
            }
          }}
        >
          {progress !== null ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              {preview ? <img src={preview} alt="" className="size-full object-cover opacity-50" /> : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-fg-strong" role="status">
                <Loader2 className="size-6 animate-spin" aria-hidden />
                Загрузка… {progress}%
              </div>
            </>
          ) : draft ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote preview (Blob / Unsplash)
            <img src={draft.url} alt={draft.alt} width={draft.width} height={draft.height} className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-fg-subtle">
              <ImageOff className="size-6" aria-hidden />
              Фото не выбрано
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="admin-btn admin-btn-secondary admin-btn-sm"
              onClick={() => fileInput.current?.click()}
              disabled={busy || progress !== null}
            >
              <Upload className="size-4" aria-hidden />
              Загрузить
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-secondary admin-btn-sm"
              onClick={() => setPickerOpen(true)}
              disabled={busy || progress !== null}
            >
              <Images className="size-4" aria-hidden />
              Выбрать в Unsplash
            </button>
            {draft ? (
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => (saved ? setConfirmRemove(true) : setDraft(null))}
                disabled={busy}
              >
                <Trash2 className="size-4" aria-hidden />
                Удалить
              </button>
            ) : null}
          </div>

          {draft ? (
            <div>
              <label htmlFor="hero-alt" className="admin-label">
                Описание фото <span className="font-normal text-fg-subtle">· обязательно</span>
              </label>
              <textarea
                id="hero-alt"
                className="admin-input"
                rows={2}
                maxLength={ALT_MAX}
                value={alt}
                aria-invalid={altError ? true : undefined}
                aria-describedby="hero-alt-hint"
                placeholder={`Например: «${site.author} в горах, улыбается, за спиной озеро»`}
                onChange={(e) => {
                  setDraft({ ...draft, alt: e.target.value.replace(/[\r\n]+/g, " ") });
                  if (altError) setAltError(null);
                }}
              />
              <p id="hero-alt-hint" className="admin-hint">
                {altError ? (
                  <span className="inline-flex items-center gap-1 text-[var(--tc-red)]">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    {altError}
                  </span>
                ) : (
                  "Для незрячих читателей и поисковиков: что на фото."
                )}
              </p>
              {draft.credit ? (
                <p className="mt-2 text-sm text-fg-subtle">
                  Фото:{" "}
                  <a href={draft.credit.profileUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-border-strong underline-offset-2 hover:text-fg">
                    {draft.credit.name}
                  </a>{" "}
                  /{" "}
                  <a href={draft.credit.photoUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-border-strong underline-offset-2 hover:text-fg">
                    Unsplash
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => void save()}
              disabled={!dirty || busy || progress !== null}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Сохранить
            </button>
            {dirty && !busy ? (
              <>
                <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setDraft(saved)}>
                  Отменить изменения
                </button>
                <span className="text-sm text-fg-subtle" role="status">
                  Есть несохранённые изменения
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <UnsplashPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialQuery="portrait woman"
        title="Фото на главную"
        width={1600}
        onSelect={(cover) => {
          setDraft(cover);
          setAltError(null);
        }}
      />
      <ConfirmDialog
        open={confirmRemove}
        title="Убрать фото с главной?"
        description="Главная страница будет без портрета, пока вы не выберете новое фото."
        confirmLabel="Убрать"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setConfirmRemove(false)}
      />
    </section>
  );
}
