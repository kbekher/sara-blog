"use client";
/** Tag chips with autocomplete (ARIA combobox). Enter or comma adds, Backspace on empty input removes the last tag. */
import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  label: string;
  placeholder?: string;
  max?: number;
};

function normalizeTag(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/^#/, "").trim().toLowerCase().slice(0, 40);
}

export function TagsInput({ value, onChange, suggestions, label, placeholder = "Добавьте тег…", max = 10 }: Props) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const listId = `${id}-list`;

  const filtered = useMemo(() => {
    const q = normalizeTag(input);
    const taken = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter((s) => !taken.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)))
      .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [input, suggestions, value]);

  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || value.some((v) => v.toLowerCase() === tag) || value.length >= max) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
    setActive(0);
  };

  const showList = open && filtered.length > 0;

  return (
    <div>
      <label htmlFor={id} className="admin-label">
        {label}
      </label>
      <div className="relative">
        <div className="admin-input flex min-h-[2.75rem] flex-wrap items-center gap-1.5 py-1.5 focus-within:border-accent">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-hover py-0.5 pr-1 pl-2.5 text-sm text-fg">
              {tag}
              <button
                type="button"
                className="rounded-full p-0.5 text-fg-subtle hover:bg-surface hover:text-fg"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Удалить тег «${tag}»`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <input
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
            className="min-w-[8rem] flex-1 bg-transparent text-base outline-none placeholder:text-fg-subtle"
            value={input}
            placeholder={value.length >= max ? "Достаточно тегов" : placeholder}
            disabled={value.length >= max}
            onChange={(e) => {
              const v = e.target.value;
              if (v.includes(",")) {
                v.split(",").slice(0, -1).forEach(add);
                setInput(v.split(",").pop() ?? "");
              } else {
                setInput(v);
              }
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 120);
              if (input.trim()) add(input);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (showList && filtered[active] && input.trim() !== filtered[active]) add(filtered[active]);
                else add(input);
              } else if (e.key === "Backspace" && !input && value.length) {
                onChange(value.slice(0, -1));
              } else if (e.key === "ArrowDown" && showList) {
                e.preventDefault();
                setActive((i) => (i + 1) % filtered.length);
              } else if (e.key === "ArrowUp" && showList) {
                e.preventDefault();
                setActive((i) => (i - 1 + filtered.length) % filtered.length);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
        </div>
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border-strong bg-bg-elevated p-1 shadow-[var(--shadow-lg)]"
          >
            {filtered.map((s, i) => (
              <li
                key={s}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={clsx("cursor-pointer rounded-lg px-3 py-2 text-sm", i === active ? "bg-surface-hover text-fg-strong" : "text-fg")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {s}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="admin-hint">Enter или запятая — добавить. Теги переводятся автоматически.</p>
    </div>
  );
}
