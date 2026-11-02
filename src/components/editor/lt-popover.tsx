"use client";
/** Popover for one LanguageTool issue: explanation, one-click replacements, ignore, add to dictionary. */
import type { Editor } from "@tiptap/react";
import { BookPlus, EyeOff } from "lucide-react";
import { clsx } from "clsx";
import type { LTIssue } from "./extensions/language-tool";
import { Popover } from "./popover";

const KIND_LABEL = { spelling: "Орфография", grammar: "Грамматика", style: "Стиль и типографика" } as const;

export function LanguageToolPopover({
  editor,
  issue,
  rect,
  onClose,
}: {
  editor: Editor;
  issue: LTIssue | null;
  rect: { left: number; top: number; bottom: number } | null;
  onClose: () => void;
}) {
  const apply = (replacement: string) => {
    if (!issue) return;
    // Make sure the text is still what LT saw before replacing.
    const current = editor.state.doc.textBetween(issue.from, issue.to, " ");
    if (current === issue.word) {
      editor.chain().focus().insertContentAt({ from: issue.from, to: issue.to }, replacement).run();
    }
    onClose();
  };

  return (
    <Popover
      open={!!issue && !!rect}
      onClose={onClose}
      anchorRect={rect}
      label="Подсказка проверки текста"
      className="editor-menu w-[min(22rem,calc(100vw-2rem))] p-3"
      restoreFocus={false}
    >
      {issue ? (
        <div>
          <div className={clsx("lt-kind", `lt-kind-${issue.kind}`)}>{KIND_LABEL[issue.kind]}</div>
          <p className="mt-1 text-sm leading-snug text-fg">{issue.match.message}</p>
          {issue.match.replacements.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {issue.match.replacements.slice(0, 6).map((r, i) => (
                <button
                  key={`${r}-${i}`}
                  type="button"
                  data-autofocus={i === 0 ? true : undefined}
                  className="lt-replacement"
                  onClick={() => apply(r)}
                  aria-label={`Заменить на «${r || "пусто"}»`}
                >
                  {r === "" ? <span className="text-fg-subtle">удалить</span> : r.replace(/ /g, " ")}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-2">
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => {
                editor.commands.ignoreLanguageToolIssue(issue);
                onClose();
              }}
            >
              <EyeOff className="size-4" aria-hidden />
              Пропустить
            </button>
            {issue.kind === "spelling" ? (
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => {
                  editor.commands.addToLanguageToolDictionary(issue.word);
                  onClose();
                }}
              >
                <BookPlus className="size-4" aria-hidden />
                Добавить в словарь
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Popover>
  );
}
