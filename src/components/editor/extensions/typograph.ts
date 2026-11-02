/**
 * "Типограф": a whole-document typographic cleanup applied as ONE ProseMirror transaction (one undo step).
 *
 * For every text block (paragraphs, headings, list items…; never code blocks) we build a string that maps
 * 1:1 onto document positions (inline code and non-text inline nodes become U+FFFC so they are never touched),
 * run the pure `typographText` over it, diff old vs new and apply the hunks back-to-front. Marks survive
 * because only the changed characters are replaced. Then runs of empty paragraphs are collapsed.
 */
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { Locale } from "@/lib/i18n/config";
import { OBJECT_CHAR, diffChars, typographText } from "@/lib/content/typography";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    typograph: {
      /** Run the full typographic cleanup. The number of fixes is stored in `editor.storage.typograph.lastFixes`. */
      runTypograph: () => ReturnType;
    };
  }
  interface Storage {
    typograph: { lastFixes: number };
  }
}

/** Text of a textblock with 1:1 positions; code-marked text and inline leaves become OBJECT_CHAR. */
function blockText(node: PMNode): string {
  let text = "";
  node.forEach((child) => {
    if (child.isText) {
      const isCode = child.marks.some((m) => m.type.spec.code);
      text += isCode ? OBJECT_CHAR.repeat(child.text!.length) : child.text!;
    } else {
      text += OBJECT_CHAR.repeat(child.nodeSize);
    }
  });
  return text;
}

/** Apply typography to `tr` (built on `doc`); returns the number of fixes. */
export function applyTypograph(tr: Transaction, locale: Locale): number {
  const doc = tr.doc;
  const edits: { from: number; to: number; insert: string }[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.spec.code) return false;
    const text = blockText(node);
    if (!text.trim()) return false;
    const next = typographText(text, locale);
    if (next === text) return false;
    for (const hunk of diffChars(text, next)) {
      const removed = text.slice(hunk.from, hunk.to);
      // Never touch protected characters.
      if (removed.includes(OBJECT_CHAR) || hunk.insert.includes(OBJECT_CHAR)) continue;
      edits.push({ from: pos + 1 + hunk.from, to: pos + 1 + hunk.to, insert: hunk.insert });
    }
    return false;
  });

  edits.sort((a, b) => b.from - a.from);
  for (const e of edits) {
    if (e.insert) tr.insertText(e.insert, e.from, e.to);
    else tr.delete(e.from, e.to);
  }

  // Collapse runs of empty paragraphs (in any container), keeping one.
  let removedParagraphs = 0;
  const empties: { from: number; to: number }[] = [];
  tr.doc.descendants((node, pos) => {
    if (!node.isBlock || node.isTextblock || node.childCount < 2) return true;
    let prevEmpty = false;
    node.forEach((child, offset) => {
      const empty = child.type.name === "paragraph" && child.content.size === 0;
      const start = pos + 1 + offset;
      if (empty && prevEmpty) empties.push({ from: start, to: start + child.nodeSize });
      prevEmpty = empty;
    });
    return true;
  });
  // The doc node itself isn't visited by descendants(); handle top level explicitly.
  {
    let prevEmpty = false;
    tr.doc.forEach((child, offset) => {
      const empty = child.type.name === "paragraph" && child.content.size === 0;
      if (empty && prevEmpty) empties.push({ from: offset, to: offset + child.nodeSize });
      prevEmpty = empty;
    });
  }
  empties.sort((a, b) => b.from - a.from);
  for (const r of empties) {
    tr.delete(r.from, r.to);
    removedParagraphs++;
  }

  return edits.length + removedParagraphs;
}

export const Typograph = Extension.create<{ locale: Locale }>({
  name: "typograph",

  addOptions() {
    return { locale: "ru" };
  },

  addStorage() {
    return { lastFixes: 0 };
  },

  addCommands() {
    return {
      runTypograph:
        () =>
        ({ tr, dispatch }) => {
          if (!dispatch) return true;
          const fixes = applyTypograph(tr, this.options.locale);
          this.storage.lastFixes = fixes;
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-t": () => this.editor.commands.runTypograph(),
    };
  },
});
