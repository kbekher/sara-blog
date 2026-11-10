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
import { PostLabel } from "@/components/site/post-label";
import { PhotoCredit } from "@/components/site/photo-credit";
import { TagList } from "@/components/site/tag-chip";
import { ShareButtons } from "@/components/site/share-buttons";
import { ReadingProgress } from "@/components/site/reading-progress";
import { ArticleSkeleton } from "@/components/site/skeletons";
import { ScrollToTop } from "@/components/site/scroll-to-top";
import { absoluteUrl, jsonLd, pageAlternates } from "../../_lib/seo";

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

      <article className="relative pt-8 sm:pt-12">
        <ScrollToTop />
        {/* Clip the overflowing glyph here so `overflow-x` on the article cannot create a
            scroll container (that left the page a few dozen pixels down on open). */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[12rem] overflow-hidden sm:h-[16rem]">
          <div className="absolute top-[-1.5rem] left-1/2 -translate-x-1/2 font-serif text-[11rem] leading-none whitespace-nowrap text-fg opacity-[0.04] select-none sm:top-[-2rem] sm:text-[17rem] lg:text-[21rem]">
            {site.author.toLocaleLowerCase()}
          </div>
        </div>

        <header className="relative mx-auto max-w-[52rem] px-5 text-center sm:px-8 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
          <Link
            href="/"
            className="group mb-8 inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] text-fg-muted transition-colors duration-300 hover:text-fg-strong sm:mb-10"
          >
            <ArrowLeft
              aria-hidden
              className="size-3.5 transition-transform duration-300 ease-apple group-hover:-translate-x-0.5"
            />
            <span>{dict.post.back}</span>
          </Link>
          <PostLabel
            className="justify-center"
            publishedAt={post.publishedAt}
            location={post.location}
            readingMinutes={post.readingMinutes}
            dict={dict}
          />
          <h1 className="mt-5 font-serif text-[2.375rem] leading-[1.08] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.25rem] lg:text-[3.875rem] lg:leading-[1.05]">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mx-auto mt-4 max-w-[40ch] font-serif text-[1.25rem] leading-snug text-fg-muted italic text-pretty sm:text-[1.375rem]">
              {post.excerpt}
            </p>
          )}
          <span aria-hidden className="mx-auto mt-7 block h-0.5 w-11 bg-accent sm:mt-8" />
        </header>

        {post.cover && (
          <figure className="relative mx-auto mt-8 box-content max-w-[1000px] px-5 sm:mt-10 sm:px-8 motion-safe:animate-[fade-in_1000ms_var(--ease-apple)_150ms_both]">
            <div className="relative aspect-[3/2] overflow-hidden rounded-[1.125rem] sm:aspect-[25/13]">
              <CoverImage cover={post.cover} priority sizes="(min-width: 1064px) 1000px, 100vw" />
            </div>
            <PhotoCredit cover={post.cover} dict={dict} className="mt-3 text-center" />
          </figure>
        )}

        <div
          className="prose-sara mt-12 px-5 sm:mt-14 sm:px-8 motion-safe:animate-[fade-up_900ms_var(--ease-out-expo)_200ms_both]"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        <span aria-hidden className="mx-auto mt-14 block h-0.5 w-11 bg-accent" />

        <footer className="mt-14 space-y-14 px-5 sm:px-8">
          <div className="article-measure flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            {post.tags.length > 0 ? (
              <div>
                <h2 className="site-label mb-3">{dict.post.tags}</h2>
                <TagList tags={post.tags} />
              </div>
            ) : (
              <span />
            )}
            <div className="sm:text-right">
              <h2 className="site-label mb-3">{dict.post.share}</h2>
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
      className={`group flex flex-col gap-2 rounded-lg py-1 ${direction === "next" ? "sm:items-end sm:text-right" : ""}`}
    >
      <span className="site-label inline-flex items-center gap-1.5">
        {direction === "prev" && (
          <ArrowLeft aria-hidden className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
        )}
        <span>{label}</span>
        {direction === "next" && (
          <ArrowRight aria-hidden className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        )}
      </span>
      <span className="max-w-[22rem] font-serif text-[1.25rem] leading-snug text-fg-strong text-balance transition-colors duration-300 group-hover:text-accent">
        {post.title}
      </span>
    </Link>
  );

  return (
    <nav aria-label={dict.post.moreReading} className="mx-auto max-w-[1000px] border-t border-border pt-8">
      <ul className="grid gap-8 sm:grid-cols-2">
        <li>{older && item(older, dict.post.previous, "prev")}</li>
        <li className="sm:flex sm:justify-end">{newer && item(newer, dict.post.next, "next")}</li>
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
