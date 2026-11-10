import Link from "next/link";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { PostSummary } from "@/lib/posts/public-queries";
import { PostLabel } from "./post-label";
import { PostImage } from "./post-image";

/**
 * "Последние записи" row: a text column (label, serif title, excerpt, pill, optional small image) next to a collage
 * of the post's images (all greyscale, colour on hover). `flip` puts the text on the right (desktop only).
 * Image count drives the layout: 0 → text-only row with a larger title; 1 → one wide image; 2 → tall + one;
 * 3+ → tall + two (a 4th image sits under the text on desktop, non-flipped rows only).
 *
 * The title is the row's focusable link; the pill and the collage are mouse shortcuts to the same URL.
 */
export function SeriesRow({
  dict,
  post,
  flip = false,
  priority = false,
}: {
  dict: Dictionary;
  post: PostSummary;
  flip?: boolean;
  priority?: boolean;
}) {
  const href = `/posts/${post.slug}`;
  const count = Math.min(post.images.length, 3);
  const mini = !flip && post.images.length >= 4;

  const text = (
    <div className={clsx("flex flex-col", count > 0 && flip && "lg:order-2")}>
      <PostLabel publishedAt={post.publishedAt} location={post.location} />
      <h3
        className={clsx(
          "mt-3.5 font-serif font-semibold text-fg-strong text-balance",
          count === 0
            ? "max-w-[22ch] text-[2.25rem] leading-[1.08] tracking-[-0.02em] sm:text-[3rem]"
            : "text-[1.75rem] leading-[1.15] tracking-[-0.01em] sm:text-[1.875rem]",
        )}
      >
        <Link href={href} className="rounded-sm transition-colors duration-300 hover:text-accent">
          {post.title}
        </Link>
      </h3>
      {post.excerpt && (
        <p
          className={clsx(
            "mt-3.5 leading-[1.7] text-fg-muted text-pretty",
            count === 0 ? "max-w-[52ch] text-[1.0625rem]" : "max-w-[24rem] text-[0.9375rem]",
          )}
        >
          {post.excerpt}
        </p>
      )}
      <div className="mt-6">
        <Link href={href} tabIndex={-1} aria-hidden className="pill group">
          <span>{dict.home.readMore}</span>
          <ArrowRight aria-hidden className="pill-arrow size-4" strokeWidth={1.75} />
        </Link>
      </div>
      {mini && (
        <Link href={href} tabIndex={-1} aria-hidden className="mt-10 hidden lg:block">
          <PostImage post={post} index={3} tone="bw" sizes="380px" className="h-[200px] rounded-[1.125rem]" />
        </Link>
      )}
    </div>
  );

  if (count === 0) {
    return <article className="border-t border-border pt-10">{text}</article>;
  }

  const sizesHalf = "(min-width: 1024px) 380px, 50vw";

  return (
    <article className={clsx("grid gap-8 lg:gap-6", flip ? "lg:grid-cols-[2fr_1fr]" : "lg:grid-cols-[1fr_2fr]")}>
      {text}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className={clsx(
          "group grid h-[300px] gap-3 sm:h-[400px] sm:gap-4 lg:h-[440px]",
          count === 1 ? "grid-cols-1" : "grid-cols-2 grid-rows-2",
          flip && "lg:order-1",
        )}
      >
        {count === 1 ? (
          <PostImage
            post={post}
            tone="bw"
            priority={priority}
            sizes="(min-width: 1024px) 780px, 100vw"
            className="h-full rounded-[1.125rem]"
          />
        ) : (
          <>
            <PostImage
              post={post}
              tone="bw"
              priority={priority}
              sizes={sizesHalf}
              className="row-span-2 h-full min-h-0 rounded-[1.125rem]"
            />
            <PostImage
              post={post}
              index={1}
              tone="bw"
              sizes={sizesHalf}
              className={clsx("min-h-0 rounded-[1.125rem]", count === 2 && "row-span-2 h-full")}
            />
            {count >= 3 && (
              <PostImage post={post} index={2} tone="bw" sizes={sizesHalf} className="min-h-0 rounded-[1.125rem]" />
            )}
          </>
        )}
      </Link>
    </article>
  );
}
