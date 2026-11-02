"use client";
/**
 * Cover image block at the top of the editor: empty state with "Unsplash" / "Загрузить",
 * full-width preview with Change / Remove, alt text and Unsplash credit.
 */
import { useRef, useState } from "react";
import { ImagePlus, Images, Upload, Trash2, RefreshCw, Loader2 } from "lucide-react";
import type { CoverImage } from "@/db/schema";
import { useToast } from "@/components/admin/toast";
import { UnsplashPicker } from "./unsplash-picker";
import { ACCEPTED_IMAGE_ACCEPT, uploadImage, validateImage } from "./upload";

type Props = {
  cover: CoverImage | null;
  onChange: (cover: CoverImage | null) => void;
  /** seeds the Unsplash search */
  title: string;
};

export function CoverArea({ cover, onChange, title }: Props) {
  const toast = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    const problem = validateImage(file);
    if (problem) {
      toast.error("Обложка не загружена", { description: problem });
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setProgress(0);
    try {
      const { url, width, height } = await uploadImage(file, { onProgress: setProgress });
      onChange({
        url,
        alt: cover?.source === "upload" ? cover.alt : "",
        width: width ?? undefined,
        height: height ?? undefined,
        source: "upload",
      });
    } catch (error) {
      toast.error("Обложка не загружена", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setProgress(null);
      setPreview(null);
      setTimeout(() => URL.revokeObjectURL(local), 2000);
    }
  };

  const fileField = (
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
  );

  const picker = (
    <UnsplashPicker
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      initialQuery={title}
      title="Обложка из Unsplash"
      onSelect={(next) => onChange(next)}
    />
  );

  if (progress !== null) {
    return (
      <div className="editor-cover" aria-busy="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
        {preview ? <img src={preview} alt="" className="opacity-50" /> : <div className="aspect-[2/1]" />}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-fg-strong" role="status">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          Загрузка обложки… {progress}%
        </div>
        {fileField}
      </div>
    );
  }

  if (!cover) {
    return (
      <div
        className="group flex flex-wrap items-center gap-2 text-sm text-fg-subtle"
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
        <span className="inline-flex items-center gap-1.5 pr-1">
          <ImagePlus className="size-4" aria-hidden />
          Добавить обложку:
        </span>
        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setPickerOpen(true)}>
          <Images className="size-4" aria-hidden />
          Unsplash
        </button>
        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Загрузить
        </button>
        {fileField}
        {picker}
      </div>
    );
  }

  return (
    <figure>
      <div className="editor-cover" style={{ backgroundColor: cover.color ?? undefined }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote cover preview inside the editor */}
        <img
          src={cover.url}
          alt={cover.alt}
          width={cover.width}
          height={cover.height}
          style={cover.width && cover.height ? { aspectRatio: `${cover.width} / ${cover.height}` } : undefined}
        />
        <div className="editor-cover-actions">
          <button type="button" className="editor-chip" onClick={() => setPickerOpen(true)} aria-label="Заменить обложку фотографией из Unsplash">
            <RefreshCw className="size-3.5" aria-hidden />
            Unsplash
          </button>
          <button type="button" className="editor-chip" onClick={() => fileInput.current?.click()} aria-label="Заменить обложку своим изображением">
            <Upload className="size-3.5" aria-hidden />
            Загрузить
          </button>
          <button type="button" className="editor-chip" onClick={() => onChange(null)} aria-label="Убрать обложку">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-col gap-2 text-sm text-fg-subtle sm:flex-row sm:items-center">
        <input
          className="min-w-0 flex-1 bg-transparent text-base text-fg-muted placeholder:text-fg-subtle focus:text-fg focus:outline-none"
          value={cover.alt}
          onChange={(e) => onChange({ ...cover, alt: e.target.value })}
          placeholder={cover.alt ? undefined : "Опишите обложку для незрячих читателей (alt)"}
          aria-label="Описание обложки (alt-текст)"
        />
        {cover.credit ? (
          <span className="shrink-0">
            Фото:{" "}
            <a href={cover.credit.profileUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-border-strong underline-offset-2 hover:text-fg">
              {cover.credit.name}
            </a>{" "}
            /{" "}
            <a href={cover.credit.photoUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-border-strong underline-offset-2 hover:text-fg">
              Unsplash
            </a>
          </span>
        ) : null}
      </figcaption>
      {fileField}
      {picker}
    </figure>
  );
}
