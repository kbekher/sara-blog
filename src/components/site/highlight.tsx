import { Fragment } from "react";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps case-insensitive occurrences of `query` in <mark>. Text-only (no HTML injection). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "giu"));
  const lower = q.toLocaleLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLocaleLowerCase() === lower ? (
          <mark key={i} className="search-hit">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
