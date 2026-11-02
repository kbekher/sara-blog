/**
 * Client-side image upload to Vercel Blob (client upload flow; the token route is /api/upload).
 */
import { upload } from "@vercel/blob/client";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;
export const ACCEPTED_IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Russian, human error message — or null when the file is fine. */
export function validateImage(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `«${file.name}»: этот формат не поддерживается. Подойдут JPEG, PNG, WebP, GIF или AVIF.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace(".", ",");
    return `«${file.name}» весит ${mb} МБ — это больше 10 МБ. Попробуйте уменьшить фото.`;
  }
  return null;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Natural pixel size of an image file (best effort; null when the browser can't decode it). */
export async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    }
  } catch {
    /* fall through to <img> */
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function safeBaseName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const ascii = base
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return ascii || "image";
}

export type UploadedImage = { url: string; width: number | null; height: number | null };

/**
 * Upload an image (validate first with `validateImage`). Progress is reported as 0–100.
 * Throws an Error with a Russian message on failure.
 */
export async function uploadImage(
  file: File,
  { onProgress, signal }: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedImage> {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  const [size] = await Promise.all([imageSize(file)]);
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const pathname = `images/${unique}-${safeBaseName(file.name)}.${EXT[file.type] ?? "jpg"}`;
  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: file.type,
      multipart: file.size > 5 * 1024 * 1024,
      abortSignal: signal,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });
    return { url: blob.url, width: size?.width ?? null, height: size?.height ?? null };
  } catch (error) {
    if (signal?.aborted) throw new Error("Загрузка отменена.");
    // The Blob client hides the server's reason behind "Failed to retrieve the client token" — ask the server why.
    if (error instanceof Error && /client token/i.test(error.message)) {
      const reason = await fetch("/api/upload", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ ok?: boolean; error?: string }>)
        .catch(() => null);
      if (reason && reason.ok === false && reason.error) throw new Error(`Не удалось загрузить «${file.name}»: ${reason.error}`);
    }
    const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
    throw new Error(`Не удалось загрузить «${file.name}». Проверьте интернет и попробуйте ещё раз.${detail}`);
  }
}
