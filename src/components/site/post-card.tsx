import Link from "next/link";
import clsx from "clsx";
import { formatYearMonth, type Dictionary } from "@/lib/i18n/get-dictionary";
import type { PostSummary } from "@/lib/posts/public-queries";
import { PostImage } from "./post-image";

/**
 * Archive card: greyscale image on top (colour on hover), italic serif title, excerpt, the date running vertically
 * along the right edge and a small diagonal stroke bottom-left. Posts without images get a text-only card.
 * The title link stretches over the text area (one tab stop, title = accessible name); the image links too.
 */
export function PostCard({ post }: { dict?: Dictionary; post: PostSummary }) {
  const hasImage = post.images.length > 0;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.125rem] bg-bg-elevated transition-transform duration-500 ease-out-expo motion-safe:hover:-translate-y-0.5">
      {hasImage && (
        // Mouse shortcut only: the title link below is the card's single tab stop and accessible name.
        <Link href={`/posts/${post.slug}`} tabIndex={-1} aria-hidden className="block shrink-0">
          <PostImage
            post={post}
            tone="bw"
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="h-[190px] sm:h-[200px]"
          />
        </Link>
      )}
      <div className={clsx("relative flex flex-1 flex-col pt-5.5 pr-12 pb-14 pl-6", hasImage ? "min-h-[10.5rem]" : "min-h-[15rem] pt-7")}>
        <h3
          className={clsx(
            "font-serif leading-snug text-fg-strong italic text-balance",
            hasImage ? "text-[1.3125rem]" : "text-[1.625rem] leading-tight",
          )}
        >
          <Link
            href={`/posts/${post.slug}`}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </Link>
        </h3>
        {post.excerpt && (
          <p
            className={clsx(
              "mt-2 text-[0.8125rem] leading-relaxed text-fg-muted text-pretty",
              hasImage ? "line-clamp-3" : "line-clamp-6",
            )}
          >
            {post.excerpt}
          </p>
        )}
        <time
          dateTime={post.publishedAt.toISOString()}
          className="absolute top-5.5 right-4.5 text-[0.625rem] tracking-[0.2em] text-fg-subtle tabular-nums [writing-mode:vertical-rl]"
        >
          {formatYearMonth(post.publishedAt)}
        </time>
        <span
          aria-hidden
          className="absolute bottom-6 left-6 h-px w-5.5 -rotate-45 bg-fg-muted transition-[width] duration-500 ease-out-expo group-hover:w-8"
        />
      </div>
    </article>
  );
}

export function PostGrid({
  dict,
  posts,
  className,
}: {
  dict: Dictionary;
  posts: PostSummary[];
  className?: string;
}) {
  return (
    <ul className={clsx("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {posts.map((post, i) => (
        <li
          key={post.id}
          className="motion-safe:animate-[fade-up_700ms_var(--ease-out-expo)_both]"
          style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
        >
          <PostCard dict={dict} post={post} />
        </li>
      ))}
    </ul>
  );
}
