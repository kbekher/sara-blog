import Link from "next/link";
import clsx from "clsx";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { PostSummary } from "@/lib/posts/public-queries";
import { CoverImage } from "./cover-image";
import { PostMeta } from "./post-meta";

function CoverFrame({
  post,
  sizes,
  priority,
  className,
}: {
  post: PostSummary;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx("relative overflow-hidden bg-bg-sunken", className)}
      // Dominant cover color as the loading placeholder (data, not a design color).
      style={post.cover?.color ? { backgroundColor: post.cover.color } : undefined}
    >
      {post.cover ? (
        <CoverImage
          cover={post.cover}
          sizes={sizes}
          priority={priority}
          className="transition-transform duration-700 ease-out-expo group-hover:scale-[1.02]"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,var(--surface-hover),transparent_60%)]"
        />
      )}
    </div>
  );
}

/** Large featured card on the home page. The whole card is one link (title is the accessible name). */
export function HeroPostCard({ locale, dict, post }: { locale: Locale; dict: Dictionary; post: PostSummary }) {
  return (
    <article className="group relative">
      <Link
        href={`/${locale}/posts/${post.slug}`}
        className="grid overflow-hidden rounded-[28px] border border-border bg-surface transition-[transform,border-color,background-color] duration-500 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-hover md:grid-cols-[1.35fr_1fr]"
      >
        <CoverFrame
          post={post}
          priority
          sizes="(min-width: 1152px) 640px, (min-width: 768px) 58vw, 100vw"
          className="aspect-[16/10] md:aspect-auto md:min-h-[26rem]"
        />
        <div className="flex flex-col justify-end gap-4 p-6 sm:p-8 md:p-10">
          <p className="text-xs font-medium tracking-[0.14em] text-accent uppercase">{dict.home.featured}</p>
          <h2
            lang={post.locale}
            className="font-serif text-[2rem] leading-[1.12] font-semibold tracking-[-0.015em] text-fg-strong text-balance sm:text-[2.5rem]"
          >
            {post.title}
          </h2>
          {post.excerpt && (
            <p lang={post.locale} className="font-serif text-lg leading-relaxed text-fg-muted italic text-pretty">
              {post.excerpt}
            </p>
          )}
          <PostMeta locale={locale} dict={dict} publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} />
        </div>
      </Link>
    </article>
  );
}

/** Apple-like grid card: subtle lift on hover, cover zooms to 1.02. */
export function PostCard({ locale, dict, post }: { locale: Locale; dict: Dictionary; post: PostSummary }) {
  return (
    <article className="group h-full">
      <Link
        href={`/${locale}/posts/${post.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-[transform,border-color,background-color] duration-500 ease-out-expo hover:-translate-y-1 hover:border-border-strong hover:bg-surface-hover"
      >
        <CoverFrame
          post={post}
          sizes="(min-width: 1152px) 360px, (min-width: 640px) 50vw, 100vw"
          className="aspect-[3/2]"
        />
        <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
          <h3
            lang={post.locale}
            className="font-serif text-[1.375rem] leading-snug font-semibold tracking-[-0.01em] text-fg-strong text-balance"
          >
            {post.title}
          </h3>
          {post.excerpt && (
            <p lang={post.locale} className="line-clamp-3 text-[0.9375rem] leading-relaxed text-fg-muted text-pretty">
              {post.excerpt}
            </p>
          )}
          <PostMeta
            className="mt-auto pt-2"
            locale={locale}
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
  locale,
  dict,
  posts,
  className,
}: {
  locale: Locale;
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
          <PostCard locale={locale} dict={dict} post={post} />
        </li>
      ))}
    </ul>
  );
}
