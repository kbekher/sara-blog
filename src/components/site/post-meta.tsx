import type { Locale } from "@/lib/i18n/config";
import { localeTags } from "@/lib/i18n/config";
import { formatDate, plural, type Dictionary } from "@/lib/i18n/get-dictionary";
import clsx from "clsx";

/** Quiet sans meta line: "2 ноября 2026 г. · 5 минут чтения". */
export function PostMeta({
  locale,
  dict,
  publishedAt,
  readingMinutes,
  className,
}: {
  locale: Locale;
  dict: Dictionary;
  publishedAt: Date;
  readingMinutes: number;
  className?: string;
}) {
  return (
    <p className={clsx("flex flex-wrap items-center gap-x-2 text-sm text-fg-muted", className)}>
      <time dateTime={publishedAt.toISOString()} lang={localeTags[locale]}>
        {formatDate(locale, publishedAt)}
      </time>
      <span aria-hidden className="text-fg-subtle">
        ·
      </span>
      <span>{plural(locale, readingMinutes, dict.post.readingTime)}</span>
    </p>
  );
}
