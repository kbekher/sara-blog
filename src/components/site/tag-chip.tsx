import Link from "next/link";
import clsx from "clsx";
import type { TagRef } from "@/lib/posts/public-queries";

export function TagChip({
  tag,
  count,
  size = "sm",
}: {
  tag: TagRef;
  count?: string;
  size?: "sm" | "lg";
}) {
  return (
    <Link
      href={`/tags/${tag.slug}`}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface text-fg-muted",
        "transition-[background-color,color,border-color] duration-300 ease-apple hover:border-border-strong hover:bg-surface-hover hover:text-fg-strong",
        size === "sm" ? "h-7 px-3 text-[0.8125rem]" : "h-10 px-4 text-[0.9375rem]",
      )}
    >
      <span>{tag.name}</span>
      {count && <span className="text-fg-subtle">{count}</span>}
    </Link>
  );
}

export function TagList({ tags, className }: { tags: TagRef[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={clsx("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <TagChip tag={tag} />
        </li>
      ))}
    </ul>
  );
}
