"use client";
/**
 * React node view for the gallery block (2–3 photos side by side). The images are not editable text: the view
 * renders them itself (no contentDOM) and changes them through transactions on the gallery node.
 *  - per photo: description (alt) + caption panel, remove
 *  - add a photo (upload or Unsplash) while there are fewer than 3, delete the whole gallery
 *  - removing down to 1 photo turns the gallery back into a plain image (see rewriteGallery / the normalizer)
 * Preview layout mirrors the public site: 2 = two columns, 3 = one large + two stacked.
 */
import { useEffect, useId, useRef, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { AlertTriangle, ImagePlus, ImageUp, Images, Loader2, TextCursorInput, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import {
  canonicalUnsplashProfileUrl,
  Gallery,
  GALLERY_MAX,
  PHOTO_CREDIT_LABEL,
  UNSPLASH_HOME,
  withUnsplashUtm,
} from "@/lib/content/extensions";
import { useToast } from "@/components/admin/toast";
import { takePendingAlt } from "./extensions/image-upload";
import { coverToImageAttrs, galleryAttrsAt, rewriteGallery, uploadedToAttrs, type ImageAttrs } from "./gallery";
import { ACCEPTED_IMAGE_ACCEPT, uploadImage, validateImage } from "./upload";

function GalleryView({ node, editor, getPos, selected }: ReactNodeViewProps) {
  const toast = useToast();
  const images: ImageAttrs[] = [];
  node.forEach((child) => images.push(child.attrs as ImageAttrs));
  const count = images.length;

  const [editing, setEditing] = useState<number | null>(null);
  const [altDraft, setAltDraft] = useState("");
  const [captionDraft, setCaptionDraft] = useState("");
  const [uploading, setUploading] = useState<{ preview: string; progress: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLTextAreaElement>(null);
  const panelId = useId();

  const position = (): number | null => {
    try {
      const p = getPos();
      return typeof p === "number" ? p : null;
    } catch {
      return null; // the node view is gone
    }
  };

  const openEditor = (index: number) => {
    const img = images[index];
    if (!img) return;
    setAltDraft(img.alt ?? "");
    setCaptionDraft(img.caption ?? "");
    setEditing(index);
  };

  // Ask for a description right after an upload/drop (same flow as single images).
  const srcKey = images.map((i) => i.src).join("\n");
  useEffect(() => {
    const srcs = srcKey.split("\n");
    const index = srcs.findIndex((src) => takePendingAlt(editor, src));
    if (index < 0) return;
    const t = setTimeout(() => {
      const attrs = galleryAttrsAt(editor, position() ?? -1)[index];
      setAltDraft(attrs?.alt ?? "");
      setCaptionDraft(attrs?.caption ?? "");
      setEditing(index);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the set of photos changes
  }, [editor, srcKey]);

  useEffect(() => {
    if (editing !== null) requestAnimationFrame(() => altRef.current?.focus());
  }, [editing]);

  /** Apply a change to the current list of photos (read fresh from the state). */
  const apply = (fn: (list: ImageAttrs[]) => ImageAttrs[]) => {
    const pos = position();
    if (pos === null) return;
    rewriteGallery(editor, pos, fn(galleryAttrsAt(editor, pos)));
  };

  const removeImage = (index: number) => {
    setEditing(null);
    apply((list) => list.filter((_, i) => i !== index));
    if (count - 1 <= 1) editor.commands.focus();
  };

  const addImage = (attrs: ImageAttrs) => {
    let added = -1;
    apply((list) => {
      if (list.length >= GALLERY_MAX) return list;
      added = list.length;
      return [...list, attrs];
    });
    if (added >= 0) {
      setAltDraft(attrs.alt ?? "");
      setCaptionDraft("");
      setEditing(added);
    }
  };

  const commitEditor = () => {
    if (editing === null) return;
    const index = editing;
    const alt = altDraft.replace(/\s+/g, " ").trim();
    const caption = captionDraft.replace(/\s+/g, " ").trim() || null;
    apply((list) => list.map((img, i) => (i === index ? { ...img, alt, caption } : img)));
    setEditing(null);
    editor.commands.focus();
  };

  const uploadFile = (file: File) => {
    const problem = validateImage(file);
    if (problem) {
      toast.error("Фото не добавлено", { description: problem });
      return;
    }
    const preview = URL.createObjectURL(file);
    setUploading({ preview, progress: 0 });
    uploadImage(file, { onProgress: (progress) => setUploading((u) => (u ? { ...u, progress } : u)) })
      .then((img) => addImage(uploadedToAttrs(img)))
      .catch((error: unknown) =>
        toast.error("Фото не добавлено", { description: error instanceof Error ? error.message : undefined }),
      )
      .finally(() => {
        setUploading(null);
        setTimeout(() => URL.revokeObjectURL(preview), 4000);
      });
  };

  const pickUnsplash = () => {
    const pick = editor.storage.editorUi?.pickUnsplashImage;
    if (!pick) return;
    pick((cover) => addImage(coverToImageAttrs(cover)));
  };

  const deleteGallery = () => {
    const pos = position();
    if (pos === null) return;
    rewriteGallery(editor, pos, []);
    editor.commands.focus();
  };

  const canAdd = count < GALLERY_MAX && !uploading;
  const current = editing !== null ? images[editing] : undefined;
  const creditName = (current?.creditName ?? "").trim();
  const creditUrl = canonicalUnsplashProfileUrl(current?.creditUrl);
  const hasCredit = current?.source === "unsplash" && !!creditName && !!creditUrl;
  const shown = uploading ? count + 1 : count;

  return (
    <NodeViewWrapper className={clsx("editor-gallery-wrap", selected && "is-selected")} data-drag-handle>
      <div
        className="editor-gallery"
        data-count={Math.min(GALLERY_MAX, Math.max(2, shown))}
        contentEditable={false}
        role="group"
        aria-label={`Галерея: ${count} фото`}
      >
        {images.map((img, i) => (
          <div key={`${img.src}-${i}`} className={clsx("editor-gallery-tile", editing === i && "is-editing")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of arbitrary blob/unsplash URLs */}
            <img src={img.src} alt={img.alt ?? ""} draggable={false} />
            <div className="editor-gallery-tile-tools">
              <button
                type="button"
                className={clsx("editor-chip", !img.alt && "editor-chip-warn")}
                onClick={() => (editing === i ? setEditing(null) : openEditor(i))}
                aria-expanded={editing === i}
                aria-controls={panelId}
                aria-label={img.alt ? `Фото ${i + 1}: изменить описание и подпись` : `Фото ${i + 1}: добавить описание (alt)`}
              >
                {img.alt ? <TextCursorInput className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
                {img.alt ? "ALT" : "Нет описания"}
              </button>
              <button
                type="button"
                className="editor-chip"
                onClick={() => removeImage(i)}
                aria-label={`Убрать фото ${i + 1} из галереи`}
                title="Убрать из галереи"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ))}
        {uploading ? (
          <div className="editor-gallery-tile is-uploading" aria-busy="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={uploading.preview} alt="" draggable={false} />
            <span className="editor-gallery-progress" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {uploading.progress >= 100 ? "Обработка…" : `${uploading.progress}%`}
            </span>
          </div>
        ) : null}
      </div>

      <div className="editor-gallery-bar" contentEditable={false}>
        <span className="editor-gallery-label">
          Галерея · {count} фото
        </span>
        {canAdd ? (
          addOpen ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={() => {
                  setAddOpen(false);
                  fileRef.current?.click();
                }}
              >
                <ImageUp className="size-4" aria-hidden />
                Загрузить
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={() => {
                  setAddOpen(false);
                  pickUnsplash();
                }}
              >
                <Images className="size-4" aria-hidden />
                Unsplash
              </button>
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setAddOpen(false)}>
                Отмена
              </button>
            </span>
          ) : (
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setAddOpen(true)}>
              <ImagePlus className="size-4" aria-hidden />
              Добавить фото
            </button>
          )
        ) : null}
        <button
          type="button"
          className="admin-btn admin-btn-ghost admin-btn-sm ml-auto"
          onClick={deleteGallery}
          aria-label="Удалить галерею целиком"
        >
          <Trash2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Удалить галерею</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          hidden
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) uploadFile(file);
          }}
        />
      </div>

      {editing !== null && current ? (
        <div id={panelId} className="editor-alt-panel" contentEditable={false}>
          <label htmlFor={`${panelId}-alt`} className="admin-label">
            Фото {editing + 1}: описание для незрячих читателей и поисковиков
          </label>
          <textarea
            id={`${panelId}-alt`}
            ref={altRef}
            className="admin-input"
            rows={2}
            value={altDraft}
            placeholder="Например: «Тропинка среди сосен, впереди озеро»"
            onChange={(e) => setAltDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitEditor();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setEditing(null);
                editor.commands.focus();
              }
            }}
          />
          <label htmlFor={`${panelId}-caption`} className="admin-label mt-3">
            Подпись <span className="font-normal text-fg-subtle">· необязательно</span>
          </label>
          <input
            id={`${panelId}-caption`}
            className="admin-input"
            value={captionDraft}
            placeholder="Видна под фото"
            onChange={(e) => setCaptionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEditor();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setEditing(null);
                editor.commands.focus();
              }
            }}
          />
          {hasCredit ? (
            <p className="editor-photo-credit" title="Подпись автора добавляется автоматически">
              {PHOTO_CREDIT_LABEL.before}
              <a href={withUnsplashUtm(creditUrl!)} target="_blank" rel="noopener noreferrer nofollow">
                {creditName}
              </a>
              {PHOTO_CREDIT_LABEL.middle}
              <a href={withUnsplashUtm(UNSPLASH_HOME)} target="_blank" rel="noopener noreferrer nofollow">
                Unsplash
              </a>
              {PHOTO_CREDIT_LABEL.after}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditing(null)}>
              Отмена
            </button>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={commitEditor}>
              Сохранить
            </button>
          </div>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

/** Gallery with the React node view — client only. */
export const EditorGallery = Gallery.extend({
  addNodeView() {
    return ReactNodeViewRenderer(GalleryView, { className: "editor-gallery-node" });
  },
});
