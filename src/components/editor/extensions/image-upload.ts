/**
 * Image uploads in the body with an inline progress placeholder.
 *
 * While a file uploads, a widget decoration (local preview + progress bar) sits where the image will go;
 * it is NOT part of the document, so autosave never stores half-uploaded images. When the upload finishes
 * the widget's (mapped) position receives a real image node, and the image view asks for alt text.
 */
import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { uploadImage, validateImage } from "../upload";

type Meta = { add?: { id: string; pos: number; element: HTMLElement } ; remove?: { id: string } };

export const imageUploadKey = new PluginKey<DecorationSet>("imageUpload");

export type ImageUploadOptions = {
  onError: (message: string) => void;
};

declare module "@tiptap/core" {
  interface Storage {
    imageUpload: {
      /** src of an image that should open its alt-text editor once rendered */
      pendingAltSrc: string | null;
    };
  }
}

function findPlaceholder(state: EditorState, id: string): number | null {
  const set = imageUploadKey.getState(state);
  const found = set?.find(undefined, undefined, (spec) => spec.id === id);
  return found && found.length ? found[0].from : null;
}

function placeholderElement(previewUrl: string): { element: HTMLElement; setProgress: (p: number) => void } {
  const element = document.createElement("figure");
  element.className = "editor-upload";
  element.setAttribute("contenteditable", "false");
  element.setAttribute("aria-busy", "true");
  const img = document.createElement("img");
  img.src = previewUrl;
  img.alt = "";
  const bar = document.createElement("div");
  bar.className = "editor-upload-bar";
  const fill = document.createElement("span");
  bar.appendChild(fill);
  const label = document.createElement("figcaption");
  label.textContent = "Загрузка… 0%";
  label.setAttribute("role", "status");
  element.append(img, bar, label);
  return {
    element,
    setProgress: (p) => {
      fill.style.width = `${p}%`;
      label.textContent = p >= 100 ? "Обработка…" : `Загрузка… ${p}%`;
    },
  };
}

/** Images are blocks: place them before an empty paragraph or after the current text block. */
function blockBoundary(editor: Editor, pos: number): number {
  const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
  if (!$pos.parent.isTextblock || $pos.depth === 0) return $pos.pos;
  return $pos.parent.content.size === 0 ? $pos.before() : $pos.after();
}

/** Upload files and insert them as images at `pos` (or at the current selection). */
export function insertImageFiles(editor: Editor, files: File[], pos: number | null, onError: (m: string) => void) {
  const insertAt = blockBoundary(editor, pos ?? editor.state.selection.from);
  for (const file of files) {
    const problem = validateImage(file);
    if (problem) {
      onError(problem);
      continue;
    }
    const id = `upload-${Math.random().toString(36).slice(2)}`;
    const preview = URL.createObjectURL(file);
    const { element, setProgress } = placeholderElement(preview);
    const tr = editor.state.tr.setMeta(imageUploadKey, { add: { id, pos: insertAt, element } } satisfies Meta);
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);

    uploadImage(file, { onProgress: setProgress })
      .then(({ url, width, height }) => {
        if (editor.isDestroyed) return;
        const at = findPlaceholder(editor.state, id);
        const done = editor.state.tr.setMeta(imageUploadKey, { remove: { id } } satisfies Meta);
        if (at !== null) {
          const node = editor.schema.nodes.image.create({ src: url, alt: "", width, height });
          done.insert(at, node);
          editor.storage.imageUpload.pendingAltSrc = url;
        }
        editor.view.dispatch(done);
      })
      .catch((error: unknown) => {
        if (!editor.isDestroyed) {
          const tr2 = editor.state.tr.setMeta(imageUploadKey, { remove: { id } } satisfies Meta);
          tr2.setMeta("addToHistory", false);
          editor.view.dispatch(tr2);
        }
        onError(error instanceof Error ? error.message : "Не удалось загрузить изображение.");
      })
      .finally(() => {
        // Keep the preview alive a moment so the swap to the real image doesn't flash.
        setTimeout(() => URL.revokeObjectURL(preview), 4000);
      });
  }
}

/** true (once) if the image with this src was just uploaded and should prompt for alt text. */
export function takePendingAlt(editor: Editor, src: string): boolean {
  const storage = editor.storage.imageUpload;
  if (!storage || storage.pendingAltSrc !== src) return false;
  storage.pendingAltSrc = null;
  return true;
}

export const ImageUpload = Extension.create<ImageUploadOptions, { pendingAltSrc: string | null }>({
  name: "imageUpload",

  addOptions() {
    return { onError: () => {} };
  },

  addStorage() {
    return { pendingAltSrc: null };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: imageUploadKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(imageUploadKey) as Meta | undefined;
            if (meta?.add) {
              const pos = Math.max(0, Math.min(meta.add.pos, tr.doc.content.size));
              const deco = Decoration.widget(pos, meta.add.element, { id: meta.add.id, side: -1 });
              next = next.add(tr.doc, [deco]);
            }
            if (meta?.remove) {
              const id = meta.remove.id;
              next = next.remove(next.find(undefined, undefined, (spec) => spec.id === id));
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            return imageUploadKey.getState(state);
          },
        },
      }),
    ];
  },
});
