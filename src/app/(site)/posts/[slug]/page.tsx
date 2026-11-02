import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { siteLocaleTag } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import {
  getAdjacentPosts,
  getPostBySlug,
  type PostDetail,
  type PostSummary,
} from "@/lib/posts/public-queries";
import { site } from "@/lib/site";
import { CoverImage } from "@/components/site/cover-image";
import { PostMeta } from "@/components/site/post-meta";
import { TagList } from "@/components/site/tag-chip";
import { ShareButtons } from "@/components/site/share-buttons";
import { ReadingProgress } from "@/components/site/reading-progress";
import { ArticleSkeleton } from "@/components/site/skeletons";
import { absoluteUrl, jsonLd, pageAlternates } from "../../_lib/seo";

const UNSPLASH_UTM = "utm_source=sara_blog&utm_medium=referral";

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;
}

export async function generateMetadata({ params }: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { robots: { index: false } };

  const path = `/posts/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: pageAlternates(path),
    authors: [{ name: site.author }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt || undefined,
      url: path,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [site.author],
      tags: post.tags.map((t) => t.name),
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt || undefined },
  };
}

/**
 * The slug is not known at build time, so params are read inside Suspense: the App Shell (header, footer,
 * skeleton) is served instantly and the article streams in, then gets cached for the next visitor.
 */
export default function PostPage({ params }: PageProps<"/posts/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <PostContent params={params} />
    </Suspense>
  );
}

async function PostContent({ params }: { params: PageProps<"/posts/[slug]">["params"] }) {
  const { slug } = await params;
  const [post, adjacent] = await Promise.all([getPostBySlug(slug), getAdjacentPosts(slug)]);
  if (!post) notFound();

  const dict = getDictionary();
  const url = absoluteUrl(`/posts/${post.slug}`);

  return (
    <>
      <ReadingProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(blogPostingLd(post, url)) }} />

      <article className="pt-10 sm:pt-14">
        <header className="article-measure px-5 sm:px-8 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-300 hover:text-fg-strong"
          >
            <ArrowLeft
              aria-hidden
              className="size-4 transition-transform duration-300 ease-apple group-hover:-translate-x-0.5"
            />
            <span>{dict.post.back}</span>
          </Link>

          {post.tags.length > 0 && (
            <div className="mt-8">
              <TagList tags={post.tags} />
            </div>
          )}

          <h1 className="mt-6 font-serif text-[2.375rem] leading-[1.1] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.25rem]">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-5 font-serif text-[1.3125rem] leading-normal text-fg-muted italic text-pretty sm:text-2xl">
              {post.excerpt}
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted">
            <span className="text-fg">{site.author}</span>
            <span aria-hidden className="text-fg-subtle">
              ·
            </span>
            <PostMeta dict={dict} publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} />
          </div>
        </header>

        {post.cover && (
          <figure className="mx-auto mt-10 box-content max-w-[1000px] sm:mt-14 sm:px-8 motion-safe:animate-[fade-in_1000ms_var(--ease-apple)_150ms_both]">
            <div
              className="relative aspect-[3/2] overflow-hidden bg-bg-sunken sm:rounded-3xl"
              style={post.cover.color ? { backgroundColor: post.cover.color } : undefined}
            >
              <CoverImage cover={post.cover} priority sizes="(min-width: 1064px) 1000px, 100vw" />
            </div>
            {post.cover.source === "unsplash" && post.cover.credit && (
              <figcaption className="mt-3 px-5 text-center text-[0.8125rem] text-fg-subtle sm:px-0">
                {dict.post.photoCredit.before}
                <a
                  href={withUtm(post.cover.credit.profileUrl)}
                  className="underline decoration-border-strong underline-offset-2 transition-colors hover:text-fg-muted"
                >
                  {post.cover.credit.name}
                </a>
                {dict.post.photoCredit.middle}
                <a
                  href={withUtm("https://unsplash.com/")}
                  className="underline decoration-border-strong underline-offset-2 transition-colors hover:text-fg-muted"
                >
                  Unsplash
                </a>
                {dict.post.photoCredit.after}
              </figcaption>
            )}
          </figure>
        )}

        <div
          className="prose-sara mt-12 px-5 sm:mt-16 sm:px-8 motion-safe:animate-[fade-up_900ms_var(--ease-out-expo)_200ms_both]"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        <footer className="article-measure mt-16 space-y-12 px-5 sm:px-8">
          <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-start sm:justify-between">
            {post.tags.length > 0 ? (
              <div>
                <h2 className="mb-3 text-xs font-medium tracking-[0.14em] text-fg-subtle uppercase">{dict.post.tags}</h2>
                <TagList tags={post.tags} />
              </div>
            ) : (
              <span />
            )}
            <div className="sm:text-right">
              <h2 className="mb-3 text-xs font-medium tracking-[0.14em] text-fg-subtle uppercase">{dict.post.share}</h2>
              <ShareButtons
                url={url}
                title={post.title}
                labels={{
                  share: dict.post.share,
                  shareNative: dict.post.shareNative,
                  copyLink: dict.post.copyLink,
                  copied: dict.post.copied,
                  copyFailed: dict.post.copyFailed,
                }}
              />
            </div>
          </div>

          <AdjacentPosts dict={dict} newer={adjacent.newer} older={adjacent.older} />
        </footer>
      </article>
    </>
  );
}

function AdjacentPosts({
  dict,
  newer,
  older,
}: {
  dict: Dictionary;
  newer: PostSummary | null;
  older: PostSummary | null;
}) {
  if (!newer && !older) return null;
  const item = (post: PostSummary, label: string, direction: "prev" | "next") => (
    <Link
      href={`/posts/${post.slug}`}
      rel={direction}
      className={`group flex h-full flex-col gap-2 rounded-2xl border border-border p-5 transition-[background-color,border-color,transform] duration-500 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-hover ${direction === "next" ? "sm:items-end sm:text-right" : ""}`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] text-fg-subtle uppercase">
        {direction === "prev" && <ArrowLeft aria-hidden className="size-3.5" />}
        <span>{label}</span>
        {direction === "next" && <ArrowRight aria-hidden className="size-3.5" />}
      </span>
      <span className="font-serif text-lg leading-snug font-semibold text-fg-strong text-balance">{post.title}</span>
    </Link>
  );

  return (
    <nav aria-label={dict.post.moreReading}>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li>{older && item(older, dict.post.previous, "prev")}</li>
        <li>{newer && item(newer, dict.post.next, "next")}</li>
      </ul>
    </nav>
  );
}

function blogPostingLd(post: PostDetail, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    inLanguage: siteLocaleTag,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: site.author, url: absoluteUrl("/") },
    publisher: { "@type": "Person", name: site.author },
    image: post.cover ? [post.cover.url] : undefined,
    keywords: post.tags.map((t) => t.name).join(", ") || undefined,
    isPartOf: { "@type": "Blog", name: site.name, url: absoluteUrl("/") },
  };
}
