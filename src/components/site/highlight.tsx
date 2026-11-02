function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wraps case-insensitive occurrences of `query` in <mark>. Text-only (no HTML injection).
 * Every part is its own element (never a bare text node beside a <mark>), so results that update while the
 * page is browser-translated are replaced element by element (see translate-guard.tsx).
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q.length < 2) return <span>{text}</span>;
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
          part && <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
