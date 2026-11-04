/**
 * Editor helpers for body images and galleries: attrs from an upload / Unsplash pick, insert and rewrite
 * a gallery (keeping the 2–3 invariant: 1 image → plain image, 0 → removed).
 */
import type { Editor } from "@tiptap/core";
import type { CoverImage } from "@/db/schema";
import { canonicalUnsplashProfileUrl, GALLERY_MAX, GALLERY_MIN } from "@/lib/content/extensions";
import type { UploadedImage } from "./upload";

/** Attributes of an `image` node (see FigureImage). */
export type ImageAttrs = {
  src: string;
  alt: string | null;
  title?: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  source: "unsplash" | null;
  creditName: string | null;
  creditUrl: string | null;
};

export function uploadedToAttrs(image: UploadedImage, alt = ""): ImageAttrs {
  return {
    src: image.url,
    alt,
    width: image.width,
    height: image.height,
    caption: null,
    source: null,
    creditName: null,
    creditUrl: null,
  };
}

/**
 * A picked Unsplash photo (the picker has already pinged /api/unsplash/download; src is hotlinked from
 * images.unsplash.com). The credit is stored as structured attrs — the caption stays the author's.
 */
export function coverToImageAttrs(cover: CoverImage): ImageAttrs {
  const creditUrl = canonicalUnsplashProfileUrl(cover.credit?.profileUrl);
  const credited = cover.source === "unsplash" && !!cover.credit?.name && !!creditUrl;
  return {
    src: cover.url,
    alt: cover.alt,
    width: cover.width ?? null,
    height: cover.height ?? null,
    caption: null,
    source: credited ? "unsplash" : null,
    creditName: credited ? cover.credit!.name : null,
    creditUrl: credited ? creditUrl : null,
  };
}

/** Gallery (2–3 images), a single image (1) or nothing (0) — as insertable JSON. */
export function galleryContent(images: ImageAttrs[]) {
  const list = images.slice(0, GALLERY_MAX).map((attrs) => ({ type: "image", attrs }));
  if (list.length === 0) return null;
  if (list.length < GALLERY_MIN) return list[0]!;
  return { type: "gallery", content: list };
}

/** Insert a gallery (or a single image) at the selection. */
export function insertGallery(editor: Editor, images: ImageAttrs[]): boolean {
  const content = galleryContent(images);
  if (!content) return false;
  return editor.chain().focus().insertContent(content).run();
}

/** Replace the gallery node at `pos` with the given images (collapsing to an image / nothing when needed). */
export function rewriteGallery(editor: Editor, pos: number, images: ImageAttrs[]): boolean {
  const { state } = editor;
  const current = state.doc.nodeAt(pos);
  if (!current || current.type.name !== "gallery") return false;
  const imageType = state.schema.nodes.image!;
  const nodes = images.slice(0, GALLERY_MAX).map((attrs) => imageType.create(attrs));
  const end = pos + current.nodeSize;
  const tr = state.tr;
  if (nodes.length === 0) tr.delete(pos, end);
  else if (nodes.length === 1) tr.replaceWith(pos, end, nodes[0]!);
  else tr.replaceWith(pos, end, current.type.create(current.attrs, nodes));
  editor.view.dispatch(tr);
  return true;
}

/** Current image attrs of the gallery at `pos` (fresh from the state; [] if it is gone). */
export function galleryAttrsAt(editor: Editor, pos: number): ImageAttrs[] {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "gallery") return [];
  const out: ImageAttrs[] = [];
  node.forEach((child) => out.push({ ...(child.attrs as ImageAttrs) }));
  return out;
}
