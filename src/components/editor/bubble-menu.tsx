"use client";
/**
 * Medium-style formatting bubble shown over a text selection.
 * Modes: main buttons → link input → color / highlight palettes (all inside the same bubble).
 */
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  Heading2,
  Heading3,
  Quote,
  Palette,
  Highlighter,
  RemoveFormatting,
  ChevronLeft,
} from "lucide-react";
import { ColorPalette } from "./color-palette";
import { setEditorUiHandler } from "./extensions/editor-ui";
import { LinkForm } from "./link-form";
import { shortcut } from "./format";

type Mode = "main" | "link" | "color" | "highlight";

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const [mode, setMode] = useState<Mode>("main");
  useEffect(() => {
    setEditorUiHandler(editor, "openBubbleLink", () => setMode("link"));
    return () => setEditorUiHandler(editor, "openBubbleLink", null);
  }, [editor]);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      quote: e.isActive("blockquote"),
      color: e.isActive("textColor"),
      highlight: e.isActive("highlight"),
    }),
  });

  const btn = (
    label: string,
    icon: React.ReactNode,
    active: boolean,
    onClick: () => void,
    keys?: string,
  ) => (
    <button
      type="button"
      className="admin-icon-btn"
      aria-label={label}
      aria-pressed={active}
      title={keys ? `${label} (${shortcut(keys)})` : label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 10, flip: true, shift: { padding: 12 }, onHide: () => setMode("main") }}
      shouldShow={({ editor: e, state, from, to }) => {
        if (!e.isEditable || from === to) return false;
        if (state.selection instanceof NodeSelection) return false;
        if (e.isActive("codeBlock")) return false;
        return state.doc.textBetween(from, to, " ").trim().length > 0;
      }}
      className="editor-bubble"
      role="toolbar"
      aria-label="Форматирование выделенного текста"
    >
      {mode === "main" ? (
        <div className="flex items-center gap-0.5">
          {btn("Жирный", <Bold className="size-4" aria-hidden />, s.bold, () => editor.chain().focus().toggleBold().run(), "Mod+B")}
          {btn("Курсив", <Italic className="size-4" aria-hidden />, s.italic, () => editor.chain().focus().toggleItalic().run(), "Mod+I")}
          {btn("Подчёркнутый", <Underline className="size-4" aria-hidden />, s.underline, () => editor.chain().focus().toggleUnderline().run(), "Mod+U")}
          {btn("Зачёркнутый", <Strikethrough className="size-4" aria-hidden />, s.strike, () => editor.chain().focus().toggleStrike().run(), "Mod+Shift+S")}
          {btn("Ссылка", <Link2 className="size-4" aria-hidden />, s.link, () => setMode("link"), "Mod+K")}
          <span className="editor-sep" aria-hidden />
          {btn("Заголовок", <Heading2 className="size-4" aria-hidden />, s.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          {btn("Подзаголовок", <Heading3 className="size-4" aria-hidden />, s.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          {btn("Цитата", <Quote className="size-4" aria-hidden />, s.quote, () => editor.chain().focus().toggleBlockquote().run())}
          <span className="editor-sep" aria-hidden />
          {btn("Цвет текста", <Palette className="size-4" aria-hidden />, s.color, () => setMode("color"))}
          {btn("Маркер", <Highlighter className="size-4" aria-hidden />, s.highlight, () => setMode("highlight"))}
          {btn("Очистить форматирование", <RemoveFormatting className="size-4" aria-hidden />, false, () =>
            editor.chain().focus().unsetAllMarks().unsetTextAlign().run(),
          )}
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="Назад"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMode("main")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 p-1">
            {mode === "link" ? (
              <div className="w-[min(22rem,70vw)]">
                <LinkForm editor={editor} onDone={() => setMode("main")} />
              </div>
            ) : (
              <ColorPalette editor={editor} mode={mode === "color" ? "text" : "highlight"} onDone={() => setMode("main")} />
            )}
          </div>
        </div>
      )}
    </BubbleMenu>
  );
}
