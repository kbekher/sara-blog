import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { fmt, type Dictionary } from "@/lib/i18n/get-dictionary";

const linkClass =
  "inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm text-fg transition-[background-color,border-color] duration-300 ease-apple hover:border-border-strong hover:bg-surface-hover";

/** Newer/older pager driven by `?page=` (page 1 has no query string, for clean canonical URLs). */
export function Pagination({
  basePath,
  page,
  pageCount,
  dict,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  dict: Dictionary;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
  return (
    <nav aria-label={dict.a11y.pagination} className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        {page > 1 && (
          <Link href={href(page - 1)} rel="prev" className={linkClass}>
            <ArrowLeft aria-hidden className="size-4" />
            <span>{dict.pagination.newer}</span>
          </Link>
        )}
      </div>
      <p className="text-sm text-fg-subtle tabular-nums" aria-current="page">
        <span key={page}>{fmt(dict.pagination.pageOf, { page, total: pageCount })}</span>
      </p>
      <div className="flex min-w-0 flex-1 justify-end">
        {page < pageCount && (
          <Link href={href(page + 1)} rel="next" className={linkClass}>
            <span>{dict.pagination.older}</span>
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </nav>
  );
}
