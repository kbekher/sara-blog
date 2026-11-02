"use client";
/**
 * Sticky, minimal top toolbar (the main formatting UI on phones, where a selection bubble is awkward).
 * Scrolls horizontally on narrow screens. Arrow keys move between buttons (roving focus).
 */
import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
  Link2,
  ImagePlus,
  Wand2,
  SpellCheck2,
  Loader2,
  ImageUp,
  Images,
} from "lucide-react";
import { clsx } from "clsx";
import type { TextAlignment } from "@/lib/content/extensions";
import type { LTStatus } from "./extensions/language-tool";
import { ColorPalette } from "./color-palette";
import { LinkForm } from "./link-form";
import { Popover } from "./popover";
import { shortcut } from "./format";

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify } as const;
const ALIGN_LABELS: Record<TextAlignment, string> = {
  left: "По левому краю",
  center: "По центру",
  right: "По правому краю",
  justify: "По ширине",
};

function ToolButton({
  label,
  keys,
  active,
  disabled,
  onClick,
  children,
  btnRef,
  expanded,
}: {
  label: string;
  keys?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  btnRef?: React.Ref<HTMLButtonElement>;
  expanded?: boolean;
}) {
  return (
    <button
      ref={btnRef}
      type="button"
      className="admin-icon-btn"
      aria-label={label}
      title={keys ? `${label} (${shortcut(keys)})` : label}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      data-active={active ? "true" : undefined}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type ToolbarProps = {
  editor: Editor;
  ltEnabled: boolean;
  ltStatus: LTStatus;
  onToggleLt: () => void;
  onTypograph: () => void;
  onPickImage: () => void;
  onPickUnsplash: () => void;
  /** registered so Mod-K with an empty selection can open the link popover */
  linkOpen: boolean;
  setLinkOpen: (open: boolean) => void;
};

export function EditorToolbar({
  editor,
  ltEnabled,
  ltStatus,
  onToggleLt,
  onTypograph,
  onPickImage,
  onPickUnsplash,
  linkOpen,
  setLinkOpen,
}: ToolbarProps) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      block: e.isActive("heading", { level: 2 })
        ? "h2"
        : e.isActive("heading", { level: 3 })
          ? "h3"
          : e.isActive("blockquote")
            ? "quote"
            : e.isActive("codeBlock")
              ? "code"
              : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      align: ((["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left") as TextAlignment,
      color: e.isActive("textColor") || e.isActive("highlight"),
      link: e.isActive("link"),
    }),
  });

  const [colorOpen, setColorOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const colorRef = useRef<HTMLButtonElement>(null);
  const alignRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLButtonElement>(null);

  const setBlock = (value: string) => {
    const chain = editor.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else if (value === "h2") chain.setHeading({ level: 2 }).run();
    else if (value === "h3") chain.setHeading({ level: 3 }).run();
    else if (value === "quote") (s.block === "quote" ? chain.lift("blockquote") : chain.setParagraph().wrapIn("blockquote")).run();
    else if (value === "code") chain.toggleCodeBlock().run();
  };

  const AlignIcon = ALIGN_ICONS[s.align];
  const ltLabel =
    ltStatus.state === "off"
      ? "Проверить"
      : ltStatus.state === "checking"
        ? "Проверка…"
        : ltStatus.state === "paused" || ltStatus.state === "error"
          ? ltStatus.reason
          : ltStatus.count > 0
            ? `Ошибок: ${ltStatus.count}`
            : "Ошибок нет";

  return (
    <div
      role="toolbar"
      aria-label="Панель форматирования"
      aria-orientation="horizontal"
      className="editor-toolbar admin-scroll-x"
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const target = e.target as HTMLElement;
        if (target.tagName === "SELECT") return;
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), select"));
        const i = items.indexOf(target);
        if (i < 0) return;
        e.preventDefault();
        items[(i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length]?.focus();
      }}
    >
      <ToolButton label="Отменить" keys="Mod+Z" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label="Повторить" keys="Mod+Shift+Z" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-[18px]" aria-hidden />
      </ToolButton>
      <span className="editor-sep" aria-hidden />

      <label className="sr-only" htmlFor="editor-block-type">
        Тип блока
      </label>
      <select
        id="editor-block-type"
        className="editor-select"
        value={s.block}
        onChange={(e) => setBlock(e.target.value)}
      >
        <option value="p">Текст</option>
        <option value="h2">Заголовок</option>
        <option value="h3">Подзаголовок</option>
        <option value="quote">Цитата</option>
        <option value="code">Код</option>
      </select>
      <span className="editor-sep" aria-hidden />

      <ToolButton label="Жирный" keys="Mod+B" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label="Курсив" keys="Mod+I" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label="Подчёркнутый" keys="Mod+U" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label="Цвет и маркер" active={s.color} expanded={colorOpen} btnRef={colorRef} onClick={() => setColorOpen((v) => !v)}>
        <Palette className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label="Ссылка" keys="Mod+K" active={s.link} expanded={linkOpen} btnRef={linkRef} onClick={() => setLinkOpen(!linkOpen)}>
        <Link2 className="size-[18px]" aria-hidden />
      </ToolButton>
      <span className="editor-sep" aria-hidden />

      <ToolButton label="Маркированный список" keys="Mod+Shift+8" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label="Нумерованный список" keys="Mod+Shift+7" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label={`Выравнивание: ${ALIGN_LABELS[s.align]}`} expanded={alignOpen} btnRef={alignRef} onClick={() => setAlignOpen((v) => !v)}>
        <AlignIcon className="size-[18px]" aria-hidden />
      </ToolButton>
      <ToolButton label="Добавить изображение" expanded={imageOpen} btnRef={imageRef} onClick={() => setImageOpen((v) => !v)}>
        <ImagePlus className="size-[18px]" aria-hidden />
      </ToolButton>
      <span className="editor-sep" aria-hidden />

      <button
        type="button"
        className="admin-btn admin-btn-ghost admin-btn-sm shrink-0"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onTypograph}
        title={`Типограф: кавычки, тире, пробелы (${shortcut("Mod+Alt+T")})`}
        aria-label="Типограф: исправить кавычки, тире и пробелы во всём тексте"
      >
        <Wand2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">Типограф</span>
      </button>
      <button
        type="button"
        className={clsx("admin-btn admin-btn-sm shrink-0", ltEnabled ? "admin-btn-secondary" : "admin-btn-ghost")}
        aria-pressed={ltEnabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleLt}
        title={ltEnabled ? "Проверка орфографии и грамматики включена — нажмите, чтобы выключить" : "Включить проверку орфографии и грамматики"}
        aria-label={ltEnabled ? `Проверка текста включена. ${ltLabel}` : "Проверить орфографию и грамматику"}
      >
        {ltStatus.state === "checking" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <SpellCheck2 className={clsx("size-4", ltEnabled && ltStatus.state === "idle" && ltStatus.count > 0 && "text-[var(--tc-red)]")} aria-hidden />
        )}
        <span aria-live="polite">{ltEnabled ? ltLabel : "Проверить"}</span>
      </button>

      <Popover open={colorOpen} onClose={() => setColorOpen(false)} anchorRef={colorRef} label="Цвет текста и маркер" className="editor-menu w-64 p-3">
        <div className="space-y-3">
          <ColorPalette editor={editor} mode="text" onDone={() => setColorOpen(false)} />
          <ColorPalette editor={editor} mode="highlight" onDone={() => setColorOpen(false)} />
        </div>
      </Popover>
      <Popover open={linkOpen} onClose={() => setLinkOpen(false)} anchorRef={linkRef} label="Ссылка" className="editor-menu w-[min(24rem,calc(100vw-2rem))] p-2">
        <LinkForm editor={editor} onDone={() => setLinkOpen(false)} />
      </Popover>
      <Popover open={alignOpen} onClose={() => setAlignOpen(false)} anchorRef={alignRef} label="Выравнивание" className="editor-menu p-1">
        <div className="flex gap-0.5">
          {(Object.keys(ALIGN_ICONS) as TextAlignment[]).map((a) => {
            const Icon = ALIGN_ICONS[a];
            return (
              <button
                key={a}
                type="button"
                className="admin-icon-btn"
                aria-label={ALIGN_LABELS[a]}
                aria-pressed={s.align === a}
                data-autofocus={s.align === a ? true : undefined}
                onClick={() => {
                  if (a === "left") editor.chain().focus().unsetTextAlign().run();
                  else editor.chain().focus().setTextAlign(a).run();
                  setAlignOpen(false);
                }}
              >
                <Icon className="size-[18px]" aria-hidden />
              </button>
            );
          })}
        </div>
      </Popover>
      <Popover open={imageOpen} onClose={() => setImageOpen(false)} anchorRef={imageRef} label="Добавить изображение" className="editor-menu w-64 p-1">
        <button
          type="button"
          className="editor-menu-item"
          onClick={() => {
            setImageOpen(false);
            onPickImage();
          }}
        >
          <span className="editor-menu-icon">
            <ImageUp className="size-4" aria-hidden />
          </span>
          <span className="text-left">
            <span className="block text-sm text-fg-strong">Загрузить</span>
            <span className="block text-xs text-fg-subtle">С телефона или компьютера</span>
          </span>
        </button>
        <button
          type="button"
          className="editor-menu-item"
          onClick={() => {
            setImageOpen(false);
            onPickUnsplash();
          }}
        >
          <span className="editor-menu-icon">
            <Images className="size-4" aria-hidden />
          </span>
          <span className="text-left">
            <span className="block text-sm text-fg-strong">Unsplash</span>
            <span className="block text-xs text-fg-subtle">Бесплатные фотографии</span>
          </span>
        </button>
      </Popover>
    </div>
  );
}
