"use client";
/** Palette of the 8 named colors (+ reset) for text color or highlight. Arrow keys move between swatches. */
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Ban } from "lucide-react";
import { clsx } from "clsx";
import type { TextColor } from "@/lib/content/types";
import { COLOR_LABELS, TEXT_COLORS } from "./format";

export function ColorPalette({
  editor,
  mode,
  onDone,
}: {
  editor: Editor;
  mode: "text" | "highlight";
  onDone?: () => void;
}) {
  const current = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      (mode === "text" ? e.getAttributes("textColor").color : e.isActive("highlight") ? e.getAttributes("highlight").color ?? "yellow" : null) as
        | TextColor
        | null,
  });

  const apply = (color: TextColor | null) => {
    const chain = editor.chain().focus();
    if (mode === "text") {
      if (color) chain.setTextColor(color).run();
      else chain.unsetTextColor().run();
    } else if (color) {
      chain.setHighlight({ color }).run();
    } else {
      chain.unsetHighlight().run();
    }
    onDone?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    buttons[(i + step + buttons.length) % buttons.length]?.focus();
  };

  const title = mode === "text" ? "Цвет текста" : "Выделение маркером";
  return (
    <div role="group" aria-label={title} onKeyDown={onKeyDown}>
      <div className="mb-2 px-1 text-xs font-medium text-fg-subtle">{title}</div>
      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => apply(null)}
          className={clsx("editor-swatch", !current && "is-active")}
          aria-label={mode === "text" ? "Обычный цвет" : "Без выделения"}
          aria-pressed={!current}
          title={mode === "text" ? "Обычный цвет" : "Без выделения"}
        >
          <Ban className="size-4 text-fg-subtle" aria-hidden />
        </button>
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => apply(c)}
            className={clsx("editor-swatch", current === c && "is-active")}
            aria-label={COLOR_LABELS[c]}
            aria-pressed={current === c}
            title={COLOR_LABELS[c]}
          >
            {mode === "text" ? (
              <span data-color={c} className="text-base font-semibold" aria-hidden>
                А
              </span>
            ) : (
              <span data-highlight={c} className="block size-5 rounded" aria-hidden />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
