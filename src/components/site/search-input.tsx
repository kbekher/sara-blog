"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import clsx from "clsx";

export type SearchInputLabels = { label: string; placeholder: string; clear: string; searching: string };

const DEBOUNCE_MS = 300;

/** Presentational field; also the static Suspense fallback (before search params are available). */
export function SearchField({
  labels,
  value,
  onChange,
  onClear,
  pending = false,
  inputRef,
}: {
  labels: SearchInputLabels;
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  pending?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
      <label htmlFor="search-q" className="sr-only">
        {labels.label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-fg-subtle"
        strokeWidth={1.75}
      />
      <input
        ref={inputRef}
        id="search-q"
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={labels.placeholder}
        value={value}
        defaultValue={value === undefined ? "" : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        className={clsx(
          "h-14 w-full rounded-full border border-border-strong bg-bg-elevated pr-14 pl-13 text-lg text-fg-strong placeholder:text-fg-subtle",
          "transition-[border-color,box-shadow] duration-300 ease-apple outline-none [&::-webkit-search-cancel-button]:appearance-none",
          "focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_var(--selection)] focus-visible:outline-none",
        )}
      />
      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center">
        {pending ? (
          <span role="status" className="inline-flex size-9 items-center justify-center text-fg-subtle">
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            <span className="sr-only">{labels.searching}</span>
          </span>
        ) : value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={labels.clear}
            className="inline-flex size-9 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg-strong"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** Debounced search box that keeps `?q=` in the URL (replace, no scroll) so results render on the server. */
export function SearchInput({ labels }: { labels: SearchInputLabels }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with back/forward navigation (URL changed while the box is not mid-edit).
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    if (urlQuery.trim() !== value.trim()) setValue(urlQuery);
  }

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!urlQuery) inputRef.current?.focus();
    // Focus once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const q = next.trim();
    if (q) params.set("q", q);
    else params.delete("q");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  }

  function onClear() {
    clearTimeout(timer.current);
    setValue("");
    navigate("");
    inputRef.current?.focus();
  }

  return (
    <SearchField
      labels={labels}
      value={value}
      onChange={onChange}
      onClear={onClear}
      pending={pending}
      inputRef={inputRef}
    />
  );
}
