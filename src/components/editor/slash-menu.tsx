"use client";
/**
 * Insert menu: opened by typing "/" (filtered by what follows) or by the "+" button on empty lines.
 * Keyboard: ↑/↓ to move, Enter to insert, Esc to close.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { Plus } from "lucide-react";
import { clsx } from "clsx";
import { setSlashKeyHandler, slashKey } from "./extensions/slash-command";
import { BLOCK_COMMANDS, filterCommands, type BlockCommand, type BlockContext } from "./block-commands";
import { Popover } from "./popover";

function CommandList({
  items,
  active,
  onHover,
  onPick,
  listId,
}: {
  items: BlockCommand[];
  active: number;
  onHover: (i: number) => void;
  onPick: (c: BlockCommand) => void;
  listId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  if (items.length === 0) {
    return <div className="px-3 py-2 text-sm text-fg-subtle">Ничего не найдено</div>;
  }
  return (
    <div ref={ref} id={listId} role="listbox" aria-label="Вставить блок" className="max-h-80 overflow-y-auto">
      {items.map((c, i) => {
        const Icon = c.icon;
        return (
          <button
            key={c.id}
            id={`${listId}-${c.id}`}
            type="button"
            role="option"
            aria-selected={i === active}
            data-index={i}
            className={clsx("editor-menu-item", i === active && "is-active")}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
          >
            <span className="editor-menu-icon">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-sm text-fg-strong">{c.label}</span>
              <span className="block truncate text-xs text-fg-subtle">{c.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "/" command palette. */
export function SlashMenu({ editor, ctx }: { editor: Editor; ctx: BlockContext }) {
  const slash = useEditorState({ editor, selector: ({ editor: e }) => slashKey.getState(e.state) ?? null });
  const [active, setActive] = useState(0);
  const listId = useId();
  const items = useMemo(() => filterCommands(slash?.query ?? ""), [slash?.query]);
  const [lastQuery, setLastQuery] = useState("");
  if ((slash?.query ?? "") !== lastQuery) {
    setLastQuery(slash?.query ?? "");
    setActive(0);
  }

  const isActive = !!slash?.active;
  const slashFrom = slash?.from ?? 0;
  const rect = useMemo(() => {
    if (!isActive) return null;
    try {
      const c = editor.view.coordsAtPos(slashFrom);
      return { left: c.left, top: c.top, bottom: c.bottom };
    } catch {
      return null;
    }
  }, [editor, isActive, slashFrom]);

  const pick = useCallback(
    (c: BlockCommand) => {
      const state = slashKey.getState(editor.state);
      if (state?.active) editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
      c.run(editor, ctx);
    },
    [editor, ctx],
  );

  const dismiss = useCallback(() => {
    editor.view.dispatch(editor.state.tr.setMeta(slashKey, { dismiss: true }));
  }, [editor]);

  // Keyboard handling is routed from the ProseMirror plugin (focus stays in the editor).
  const stateRef = useRef({ items, active });
  useEffect(() => {
    stateRef.current = { items, active };
  }, [items, active]);
  useEffect(() => {
    setSlashKeyHandler(editor, (event) => {
      const { items: list, active: idx } = stateRef.current;
      if (event.key === "ArrowDown") {
        setActive((idx + 1) % Math.max(list.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((idx - 1 + list.length) % Math.max(list.length, 1));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const c = list[idx];
        if (!c) return false;
        pick(c);
        return true;
      }
      if (event.key === "Escape") {
        dismiss();
        return true;
      }
      return false;
    });
    return () => setSlashKeyHandler(editor, null);
  }, [editor, pick, dismiss]);

  return (
    <Popover
      open={!!slash?.active && !!rect}
      onClose={dismiss}
      anchorRect={rect}
      label="Вставить блок"
      className="editor-menu w-72"
      restoreFocus={false}
    >
      <CommandList items={items} active={active} onHover={setActive} onPick={pick} listId={listId} />
    </Popover>
  );
}

/** "+" button on empty lines that opens the same insert menu. */
export function PlusMenu({ editor, ctx }: { editor: Editor; ctx: BlockContext }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const pick = (c: BlockCommand) => {
    setOpen(false);
    c.run(editor, ctx);
  };

  return (
    <>
      <FloatingMenu
        editor={editor}
        options={{ placement: "left", offset: 12 }}
        shouldShow={({ editor: e, state }) => {
          const { $from, empty } = state.selection;
          if (!e.isEditable || !empty) return false;
          if (!$from.parent.isTextblock || $from.parent.type.name !== "paragraph") return false;
          if ($from.depth > 1) return false; // not inside lists/quotes
          return $from.parent.content.size === 0;
        }}
        className="editor-plus-wrap"
      >
        <button
          ref={buttonRef}
          type="button"
          className={clsx("editor-plus", open && "is-open")}
          aria-label="Вставить блок"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setActive(0);
            setOpen((v) => !v);
          }}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </FloatingMenu>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        placement="bottom-start"
        label="Вставить блок"
        className="editor-menu w-72"
      >
        <div
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = BLOCK_COMMANDS.length;
              setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(BLOCK_COMMANDS[active]);
            }
          }}
          tabIndex={-1}
          data-autofocus
          ref={listRef}
          className="outline-none"
          aria-activedescendant={`${listId}-${BLOCK_COMMANDS[active]?.id}`}
        >
          <CommandList items={BLOCK_COMMANDS} active={active} onHover={setActive} onPick={pick} listId={listId} />
        </div>
      </Popover>
    </>
  );
}
