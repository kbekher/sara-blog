"use client";
/** Inline URL editor: validates, adds https:// automatically, supports e-mail, remove link. */
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Check, Unlink, ExternalLink } from "lucide-react";
import { normalizeUrl } from "./format";

export function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const existing = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [value, setValue] = useState(existing);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!value.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onDone();
      return;
    }
    const href = normalizeUrl(value);
    if (!href) {
      setError("Похоже, это не ссылка. Пример: example.com или https://…");
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // No selection: insert the URL itself as linked text.
      chain.insertContent({ type: "text", text: value.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    onDone();
  };

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="min-w-0 flex-1">
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="editor-link-input"
          placeholder="Вставьте или введите ссылку"
          aria-label="Адрес ссылки"
          aria-invalid={!!error}
          value={value}
          data-autofocus
          autoFocus
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onDone();
              editor.commands.focus();
            }
          }}
        />
        {error ? (
          <p role="alert" className="px-2 pt-1 text-xs text-[var(--tc-red)]">
            {error}
          </p>
        ) : null}
      </div>
      <button type="submit" className="admin-icon-btn" aria-label="Применить ссылку">
        <Check className="size-4" aria-hidden />
      </button>
      {existing ? (
        <>
          <a href={existing} target="_blank" rel="noopener noreferrer" className="admin-icon-btn" aria-label="Открыть ссылку в новой вкладке">
            <ExternalLink className="size-4" aria-hidden />
          </a>
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="Убрать ссылку"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              onDone();
            }}
          >
            <Unlink className="size-4" aria-hidden />
          </button>
        </>
      ) : null}
    </form>
  );
}
