import clsx from "clsx";
import { formatDate, plural, type Dictionary } from "@/lib/i18n/get-dictionary";

/** Quiet sans meta line: "2 ноября 2026 г. · 5 минут чтения". */
export function PostMeta({
  dict,
  publishedAt,
  readingMinutes,
  className,
}: {
  dict: Dictionary;
  publishedAt: Date;
  readingMinutes: number;
  className?: string;
}) {
  return (
    <p className={clsx("flex flex-wrap items-center gap-x-2 text-sm text-fg-muted", className)}>
      <time dateTime={publishedAt.toISOString()}>{formatDate(publishedAt)}</time>
      <span aria-hidden className="text-fg-subtle">
        ·
      </span>
      <span>{plural(readingMinutes, dict.post.readingTime)}</span>
    </p>
  );
}
