import Link from "next/link";
import clsx from "clsx";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { PostSummary } from "@/lib/posts/public-queries";
import { CoverImage } from "./cover-image";
import { PostMeta } from "./post-meta";

/** Cover area of a card. Only rendered when the post has a cover: cover-less cards are text-only. */
function CoverFrame({
  cover,
  sizes,
  priority,
  className,
}: {
  cover: NonNullable<PostSummary["cover"]>;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx("relative overflow-hidden bg-bg-sunken", className)}
      // Dominant cover color as the loading placeholder (data, not a design color).
      style={cover.color ? { backgroundColor: cover.color } : undefined}
    >
      <CoverImage
        cover={cover}
        sizes={sizes}
        priority={priority}
        className="transition-transform duration-700 ease-out-expo group-hover:scale-[1.02]"
      />
    </div>
  );
}

/** Faint accent glow behind text-only (cover-less) cards, so they don't read as a flat empty box. */
const TEXT_CARD_GLOW =
  "bg-[radial-gradient(90%_120%_at_0%_0%,color-mix(in_oklab,var(--accent)_9%,transparent),transparent_65%)]";

/** Large featured card on the home page. The whole card is one link (title is the accessible name). */
export function HeroPostCard({ dict, post }: { dict: Dictionary; post: PostSummary }) {
  const { cover } = post;
  return (
    <article className="group relative">
      <Link
        href={`/posts/${post.slug}`}
        className={clsx(
          "grid overflow-hidden rounded-[28px] border border-border bg-surface transition-[transform,border-color,background-color] duration-500 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-hover",
          cover ? "md:grid-cols-[1.35fr_1fr]" : TEXT_CARD_GLOW,
        )}
      >
        {cover && (
          <CoverFrame
            cover={cover}
            priority
            sizes="(min-width: 1152px) 640px, (min-width: 768px) 58vw, 100vw"
            className="aspect-[16/10] md:aspect-auto md:min-h-[26rem]"
          />
        )}
        <div
          className={clsx(
            "flex flex-col justify-end gap-4",
            cover ? "p-6 sm:p-8 md:p-10" : "p-7 sm:p-10 md:px-14 md:py-16",
          )}
        >
          <p className="text-xs font-medium tracking-[0.14em] text-accent uppercase">{dict.home.featured}</p>
          <h2
            className={clsx(
              "font-serif font-semibold text-fg-strong text-balance",
              cover
                ? "text-[2rem] leading-[1.12] tracking-[-0.015em] sm:text-[2.5rem]"
                : "max-w-[22ch] text-[2.25rem] leading-[1.08] tracking-[-0.02em] sm:text-[3rem] md:text-[3.5rem]",
            )}
          >
            {post.title}
          </h2>
          {post.excerpt && (
            <p
                className={clsx(
                "font-serif leading-relaxed text-fg-muted italic text-pretty",
                cover ? "text-lg" : "max-w-[48ch] text-lg sm:text-xl",
              )}
            >
              {post.excerpt}
            </p>
          )}
          <PostMeta dict={dict} publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} />
        </div>
      </Link>
    </article>
  );
}

/** Apple-like grid card: subtle lift on hover, cover zooms to 1.02. */
export function PostCard({ dict, post }: { dict: Dictionary; post: PostSummary }) {
  const { cover } = post;
  return (
    <article className="group h-full">
      <Link
        href={`/posts/${post.slug}`}
        className={clsx(
          "flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-[transform,border-color,background-color] duration-500 ease-out-expo hover:-translate-y-1 hover:border-border-strong hover:bg-surface-hover",
          !cover && TEXT_CARD_GLOW,
        )}
      >
        {cover && (
          <CoverFrame
            cover={cover}
            sizes="(min-width: 1152px) 360px, (min-width: 640px) 50vw, 100vw"
            className="aspect-[3/2]"
          />
        )}
        <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
          <h3
            className="font-serif text-[1.375rem] leading-snug font-semibold tracking-[-0.01em] text-fg-strong text-balance"
          >
            {post.title}
          </h3>
          {post.excerpt && (
            <p
                className={clsx(
                "text-[0.9375rem] leading-relaxed text-fg-muted text-pretty",
                // Text-only cards have room for a longer excerpt.
                cover ? "line-clamp-3" : "line-clamp-5",
              )}
            >
              {post.excerpt}
            </p>
          )}
          <PostMeta
            className="mt-auto pt-2"
            dict={dict}
            publishedAt={post.publishedAt}
            readingMinutes={post.readingMinutes}
          />
        </div>
      </Link>
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
    <ul className={clsx("grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6", className)}>
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
