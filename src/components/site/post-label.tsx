import clsx from "clsx";
import { fmt, formatMonthYear, type Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Tracked label line: "НОЯБРЬ 2026 | Альпы, Швейцария · 6 мин" (month + year in the site time zone, accent).
 * The location appears only when set; reading time only when `dict` + `readingMinutes` are passed.
 * Each dynamic part is its own element (translation-safe).
 */
export function PostLabel({
  publishedAt,
  location,
  readingMinutes,
  dict,
  className,
}: {
  publishedAt: Date;
  location?: string | null;
  readingMinutes?: number;
  dict?: Dictionary;
  className?: string;
}) {
  return (
    <p className={clsx("site-label flex flex-wrap items-center gap-x-2.5 gap-y-1", className)}>
      <time dateTime={publishedAt.toISOString()} className="site-label-accent">
        {formatMonthYear(publishedAt)}
      </time>
      {location && (
        <>
          <span aria-hidden className="opacity-60">
            |
          </span>
          <span>{location}</span>
        </>
      )}
      {dict && readingMinutes !== undefined && (
        <>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <span>{fmt(dict.post.minutesShort, { n: readingMinutes })}</span>
        </>
      )}
    </p>
  );
}
