/**
 * Glue between keyboard shortcuts and React UI: the editor components register callbacks in storage.
 *  Mod-K  → open the link editor (bubble when text is selected, toolbar popover otherwise)
 *  Mod-S  → save now
 *  (no key) pickUnsplashImage → the gallery node view asks the body editor for an Unsplash photo
 *  Mod-Shift-7 / Mod-Shift-8 → ordered / bullet list (StarterKit already binds these; kept for clarity)
 */
import { Extension, type Editor } from "@tiptap/core";
import type { CoverImage } from "@/db/schema";

export type EditorUiStorage = {
  openLink: (() => void) | null;
  /** registered by the bubble menu: switch it to its link input */
  openBubbleLink: (() => void) | null;
  save: (() => void) | null;
  /** registered by the body editor: open the Unsplash picker and hand the picked photo to `onSelect` */
  pickUnsplashImage: ((onSelect: (cover: CoverImage) => void) => void) | null;
};

declare module "@tiptap/core" {
  interface Storage {
    editorUi: EditorUiStorage;
  }
}

/** Register (or clear with null) a UI callback. Kept outside React components on purpose. */
export function setEditorUiHandler<K extends keyof EditorUiStorage>(editor: Editor, key: K, handler: EditorUiStorage[K]): void {
  editor.storage.editorUi[key] = handler;
}

export const EditorUi = Extension.create<object, EditorUiStorage>({
  name: "editorUi",

  addStorage() {
    return { openLink: null, openBubbleLink: null, save: null, pickUnsplashImage: null };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        this.storage.openLink?.();
        return true;
      },
      "Mod-s": () => {
        this.storage.save?.();
        return true;
      },
    };
  },
});
