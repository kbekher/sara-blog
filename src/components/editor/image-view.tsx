"use client";
/**
 * React node view for body images: the picture, an always-visible caption field and an "ALT" editor
 * (opened automatically right after an upload — describing images is an accessibility must).
 */
import { useEffect, useId, useRef, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Trash2, TextCursorInput, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { FigureImage } from "@/lib/content/extensions";

function ImageView({ node, updateAttributes, deleteNode, selected, editor, getPos }: ReactNodeViewProps) {
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? "";
  const caption = (node.attrs.caption as string | null) ?? "";
  const width = node.attrs.width as number | null;
  const height = node.attrs.height as number | null;
  const [altOpen, setAltOpen] = useState(false);
  const [altDraft, setAltDraft] = useState(alt);
  const altId = useId();
  const altRef = useRef<HTMLTextAreaElement>(null);

  // Ask for alt text right after an upload.
  useEffect(() => {
    if (editor.storage.imageUpload?.pendingAltSrc === src) {
      editor.storage.imageUpload.pendingAltSrc = null;
      const t = setTimeout(() => {
        setAltDraft(alt);
        setAltOpen(true);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [editor, src, alt]);

  useEffect(() => {
    if (altOpen) requestAnimationFrame(() => altRef.current?.focus());
  }, [altOpen]);

  const commitAlt = () => {
    updateAttributes({ alt: altDraft.replace(/\s+/g, " ").trim() });
    setAltOpen(false);
    editor.commands.focus();
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={clsx("editor-figure", selected && "is-selected")}
      data-drag-handle
    >
      <div className="editor-figure-media">
        {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of arbitrary blob/unsplash URLs */}
        <img src={src} alt={alt} width={width ?? undefined} height={height ?? undefined} draggable={false} />
        <div className="editor-figure-tools" contentEditable={false}>
          <button
            type="button"
            className={clsx("editor-chip", !alt && "editor-chip-warn")}
            onClick={() => {
              setAltDraft(alt);
              setAltOpen((v) => !v);
            }}
            aria-expanded={altOpen}
            aria-controls={altId}
            aria-label={alt ? "Изменить описание изображения" : "Добавить описание изображения (alt)"}
          >
            {alt ? <TextCursorInput className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
            {alt ? "ALT" : "Нет описания"}
          </button>
          <button type="button" className="editor-chip" onClick={() => deleteNode()} aria-label="Удалить изображение">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {altOpen ? (
        <div id={altId} className="editor-alt-panel" contentEditable={false}>
          <label htmlFor={`${altId}-input`} className="admin-label">
            Описание для незрячих читателей и поисковиков
          </label>
          <textarea
            id={`${altId}-input`}
            ref={altRef}
            className="admin-input"
            rows={2}
            value={altDraft}
            placeholder="Например: «Закат над морем, на песке две пары следов»"
            onChange={(e) => setAltDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitAlt();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setAltOpen(false);
                editor.commands.focus();
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setAltOpen(false)}>
              Отмена
            </button>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={commitAlt}>
              Сохранить
            </button>
          </div>
        </div>
      ) : null}

      <input
        className="editor-caption"
        contentEditable={false}
        value={caption}
        placeholder="Подпись (необязательно)"
        aria-label="Подпись к изображению"
        onChange={(e) => updateAttributes({ caption: e.target.value || null })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Continue writing below the image.
            const pos = getPos();
            if (typeof pos !== "number") return;
            const after = pos + node.nodeSize;
            editor
              .chain()
              .insertContentAt(after, { type: "paragraph" })
              .focus(after + 1)
              .run();
          }
        }}
      />
    </NodeViewWrapper>
  );
}

/** FigureImage with the React node view — client only. */
export const EditorImage = FigureImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({ inline: false, allowBase64: false, resize: false });
