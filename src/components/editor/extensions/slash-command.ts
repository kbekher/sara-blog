/**
 * Slash menu state: typing "/" at the start of an empty block (or after a space) opens the insert menu;
 * the text after the slash filters it. Pure plugin state — the menu itself is React (../slash-menu.tsx),
 * which registers a key handler in `editor.storage.slashCommand.onKeyDown` for ↑ ↓ Enter Esc.
 */
import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type SlashState = {
  active: boolean;
  /** document range of "/query" (to delete when a command is chosen) */
  from: number;
  to: number;
  query: string;
};

type SlashPluginState = SlashState & { dismissedAt: number | null };

export const slashKey = new PluginKey<SlashPluginState>("slashCommand");

const INACTIVE: SlashState = { active: false, from: 0, to: 0, query: "" };

declare module "@tiptap/core" {
  interface Storage {
    slashCommand: { onKeyDown: ((event: KeyboardEvent) => boolean) | null };
  }
}

/** Route ↑ ↓ Enter Esc to the React menu while the slash menu is open (null to unregister). */
export function setSlashKeyHandler(editor: Editor, handler: ((event: KeyboardEvent) => boolean) | null): void {
  editor.storage.slashCommand.onKeyDown = handler;
}

export const SlashCommand = Extension.create<object, { onKeyDown: ((event: KeyboardEvent) => boolean) | null }>({
  name: "slashCommand",

  addStorage() {
    return { onKeyDown: null };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin<SlashPluginState>({
        key: slashKey,
        state: {
          init: (): SlashPluginState => ({ ...INACTIVE, dismissedAt: null }),
          apply(tr, prev, _old, state): SlashPluginState {
            const dismiss = tr.getMeta(slashKey) as { dismiss?: boolean } | undefined;
            const { selection } = state;
            if (!selection.empty) return { ...INACTIVE, dismissedAt: null };
            const $pos = selection.$from;
            if ($pos.parent.type.spec.code || !$pos.parent.isTextblock) return { ...INACTIVE, dismissedAt: null };
            const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, undefined, "\uFFFC");
            const m = /(?:^|\s)\/([\p{L}\p{N}]{0,24})$/u.exec(textBefore);
            if (!m) return { ...INACTIVE, dismissedAt: null };
            const from = $pos.pos - m[1].length - 1;
            if (dismiss?.dismiss) return { ...INACTIVE, dismissedAt: from };
            if (prev.dismissedAt === from) return { ...INACTIVE, dismissedAt: from };
            return { active: true, from, to: $pos.pos, query: m[1], dismissedAt: null };
          },
        },
        props: {
          handleKeyDown(view, event) {
            const state = slashKey.getState(view.state);
            if (!state?.active || !storage.onKeyDown) return false;
            return storage.onKeyDown(event);
          },
        },
      }),
    ];
  },
});
