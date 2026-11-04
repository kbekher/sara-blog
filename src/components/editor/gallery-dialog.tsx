"use client";
/**
 * «Галерея (2–3 фото)»: collect 2–3 photos (uploads — several at once — and/or Unsplash picks one by one),
 * describe them, then insert the gallery block at the selection.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ImageUp, Images, Loader2, X } from "lucide-react";
import { GALLERY_MAX, GALLERY_MIN } from "@/lib/content/extensions";
import { Dialog } from "@/components/admin/dialog";
import { useToast } from "@/components/admin/toast";
import { coverToImageAttrs, uploadedToAttrs, type ImageAttrs } from "./gallery";
import { UnsplashPicker } from "./unsplash-picker";
import { ACCEPTED_IMAGE_ACCEPT, uploadImage, validateImage } from "./upload";

type Item =
  | { key: string; status: "uploading"; preview: string; progress: number }
  | { key: string; status: "ready"; attrs: ImageAttrs };

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (images: ImageAttrs[]) => void;
  /** Seeds the Unsplash search (the post title). */
  initialQuery?: string;
};

const newKey = () => Math.random().toString(36).slice(2);

export function GalleryDialog({ open, onClose: close, onInsert, initialQuery }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());

  // Unmounting cancels unfinished uploads.
  useEffect(() => {
    const map = aborts.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  /** Closing cancels unfinished uploads and starts the next gallery from scratch. */
  const onClose = () => {
    aborts.current.forEach((c) => c.abort());
    aborts.current.clear();
    setItems([]);
    close();
  };

  const free = GALLERY_MAX - items.length;
  const ready = items.filter((i): i is Extract<Item, { status: "ready" }> => i.status === "ready");
  const busy = items.some((i) => i.status === "uploading");
  const canInsert = !busy && ready.length >= GALLERY_MIN && ready.length <= GALLERY_MAX;

  const addFiles = (files: File[]) => {
    if (files.length > free) {
      toast.info(`В галерее помещается до ${GALLERY_MAX} фото`, {
        description: free > 0 ? `Добавлены первые ${free}.` : "Уберите одно из фото, чтобы добавить другое.",
      });
    }
    for (const file of files.slice(0, Math.max(0, free))) {
      const problem = validateImage(file);
      if (problem) {
        toast.error("Фото не добавлено", { description: problem });
        continue;
      }
      const key = newKey();
      const preview = URL.createObjectURL(file);
      const controller = new AbortController();
      aborts.current.set(key, controller);
      setItems((list) => [...list, { key, status: "uploading", preview, progress: 0 }]);
      uploadImage(file, {
        signal: controller.signal,
        onProgress: (progress) =>
          setItems((list) => list.map((i) => (i.key === key && i.status === "uploading" ? { ...i, progress } : i))),
      })
        .then((img) =>
          setItems((list) => list.map((i) => (i.key === key ? { key, status: "ready", attrs: uploadedToAttrs(img) } : i))),
        )
        .catch((error: unknown) => {
          setItems((list) => list.filter((i) => i.key !== key));
          if (!controller.signal.aborted) {
            toast.error("Фото не добавлено", { description: error instanceof Error ? error.message : undefined });
          }
        })
        .finally(() => {
          aborts.current.delete(key);
          setTimeout(() => URL.revokeObjectURL(preview), 4000);
        });
    }
  };

  const remove = (key: string) => {
    aborts.current.get(key)?.abort();
    setItems((list) => list.filter((i) => i.key !== key));
  };

  const setAlt = (key: string, alt: string) =>
    setItems((list) => list.map((i) => (i.key === key && i.status === "ready" ? { ...i, attrs: { ...i.attrs, alt } } : i)));

  const insert = () => {
    if (!canInsert) return;
    onInsert(ready.map((i) => ({ ...i.attrs, alt: (i.attrs.alt ?? "").replace(/\s+/g, " ").trim() })));
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Галерея"
        description="2 или 3 фото рядом. Из трёх одно будет крупным, два — поменьше."
        size="lg"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-sm text-fg-subtle" role="status">
              {busy ? "Загрузка…" : ready.length < GALLERY_MIN ? `Добавьте ещё ${GALLERY_MIN - ready.length} фото` : `${ready.length} фото`}
            </span>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={insert} disabled={!canInsert}>
              Вставить галерею
            </button>
          </div>
        }
      >
        <div className="editor-gallery-picker" data-count={Math.max(GALLERY_MIN, items.length)}>
          {items.map((item, index) => (
            <div key={item.key} className="editor-gallery-picker-item">
              <div className="editor-gallery-picker-media">
                {/* eslint-disable-next-line @next/next/no-img-element -- local/remote previews */}
                <img src={item.status === "ready" ? item.attrs.src : item.preview} alt="" />
                {item.status === "uploading" ? (
                  <span className="editor-gallery-progress" role="status">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {item.progress >= 100 ? "Обработка…" : `${item.progress}%`}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="editor-chip absolute top-2 right-2"
                  onClick={() => remove(item.key)}
                  aria-label={`Убрать фото ${index + 1}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
              {item.status === "ready" ? (
                <label className="mt-2 block">
                  <span className="sr-only">Описание фото {index + 1}</span>
                  <input
                    className="admin-input"
                    value={item.attrs.alt ?? ""}
                    placeholder="Что на фото? (alt)"
                    onChange={(e) => setAlt(item.key, e.target.value)}
                  />
                  {!item.attrs.alt?.trim() ? (
                    <span className="mt-1 flex items-center gap-1 text-xs text-fg-subtle">
                      <AlertTriangle className="size-3" aria-hidden />
                      Нужно для незрячих читателей
                    </span>
                  ) : null}
                </label>
              ) : null}
            </div>
          ))}
          {free > 0 ? (
            <div className="editor-gallery-picker-add">
              <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" data-autofocus onClick={() => fileRef.current?.click()}>
                <ImageUp className="size-4" aria-hidden />
                Загрузить
              </button>
              <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setUnsplashOpen(true)}>
                <Images className="size-4" aria-hidden />
                Unsplash
              </button>
              <span className="text-xs text-fg-subtle">Можно выбрать несколько файлов сразу</span>
            </div>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          multiple
          hidden
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) addFiles(files);
          }}
        />
      </Dialog>
      <UnsplashPicker
        open={unsplashOpen}
        onClose={() => setUnsplashOpen(false)}
        initialQuery={initialQuery}
        width={1600}
        title="Фото для галереи"
        onSelect={(cover) =>
          setItems((list) => (list.length >= GALLERY_MAX ? list : [...list, { key: newKey(), status: "ready", attrs: coverToImageAttrs(cover) }]))
        }
      />
    </>
  );
}
