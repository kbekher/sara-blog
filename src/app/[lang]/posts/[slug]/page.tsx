import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Languages } from "lucide-react";
import { isLocale, localeTags, type Locale } from "@/lib/i18n/config";
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
import { NewsletterForm } from "@/components/site/newsletter-form";
import { ReadingProgress } from "@/components/site/reading-progress";
import { ArticleSkeleton } from "@/components/site/skeletons";
import { absoluteUrl, jsonLd, localePath, pageAlternates } from "../../_lib/seo";

const UNSPLASH_UTM = "utm_source=sara_blog&utm_medium=referral";

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/posts/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const post = await getPostBySlug(lang, slug);
  if (!post) return { robots: { index: false } };

  const path = `/posts/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: {
      ...pageAlternates(lang, path),
      // A not-yet-translated page shows the original text, so point search engines at the original.
      canonical: localePath(post.isFallback ? post.locale : lang, path),
    },
    authors: [{ name: site.author }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt || undefined,
      url: localePath(lang, path),
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
export default function PostPage({ params }: PageProps<"/[lang]/posts/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <PostContent params={params} />
    </Suspense>
  );
}

async function PostContent({ params }: { params: PageProps<"/[lang]/posts/[slug]">["params"] }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const [post, adjacent] = await Promise.all([getPostBySlug(lang, slug), getAdjacentPosts(lang, slug)]);
  if (!post) notFound();

  const dict = getDictionary(lang);
  const url = absoluteUrl(localePath(lang, `/posts/${post.slug}`));
  const originalHref = localePath(post.sourceLocale, `/posts/${post.slug}`);

  return (
    <>
      <ReadingProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(blogPostingLd(post, lang, url)) }} />

      <article lang={post.locale} className="pt-10 sm:pt-14">
        <header className="article-measure px-5 sm:px-8 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
          <Link
            href={`/${lang}`}
            lang={lang}
            className="group inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-300 hover:text-fg-strong"
          >
            <ArrowLeft
              aria-hidden
              className="size-4 transition-transform duration-300 ease-apple group-hover:-translate-x-0.5"
            />
            {dict.post.back}
          </Link>

          {post.tags.length > 0 && (
            <div lang={lang} className="mt-8">
              <TagList locale={lang} tags={post.tags} />
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
          <div lang={lang} className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted">
            <span className="text-fg">{site.author}</span>
            <span aria-hidden className="text-fg-subtle">
              ·
            </span>
            <PostMeta locale={lang} dict={dict} publishedAt={post.publishedAt} readingMinutes={post.readingMinutes} />
          </div>

          <TranslationNotice post={post} lang={lang} dict={dict} originalHref={originalHref} />
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
              <figcaption lang={lang} className="mt-3 px-5 text-center text-[0.8125rem] text-fg-subtle sm:px-0">
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

        <footer lang={lang} className="article-measure mt-16 space-y-12 px-5 sm:px-8">
          <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-start sm:justify-between">
            {post.tags.length > 0 ? (
              <div>
                <h2 className="mb-3 text-xs font-medium tracking-[0.14em] text-fg-subtle uppercase">{dict.post.tags}</h2>
                <TagList locale={lang} tags={post.tags} />
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

          <NewsletterForm locale={lang} labels={dict.newsletter} />

          <AdjacentPosts lang={lang} dict={dict} newer={adjacent.newer} older={adjacent.older} />
        </footer>
      </article>
    </>
  );
}

function TranslationNotice({
  post,
  lang,
  dict,
  originalHref,
}: {
  post: PostDetail;
  lang: Locale;
  dict: Dictionary;
  originalHref: string;
}) {
  if (post.isFallback) {
    const { before, link, after } = dict.post.notTranslated;
    return (
      <p lang={lang} className="mt-8 flex gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted">
        <Languages aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
        <span>
          {before}
          <Link href={originalHref} hrefLang={post.locale} className="text-accent underline-offset-4 hover:underline">
            {link}
          </Link>
          {after}
        </span>
      </p>
    );
  }
  if (post.isMachineTranslated && post.locale !== post.sourceLocale) {
    return (
      <p lang={lang} className="mt-8 flex items-center gap-2 text-sm text-fg-subtle">
        <Languages aria-hidden className="size-4 shrink-0" />
        <span>
          {dict.post.machineTranslated[post.sourceLocale]}
          <span aria-hidden> · </span>
          <Link
            href={originalHref}
            hrefLang={post.sourceLocale}
            className="text-fg-muted underline decoration-border-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          >
            {dict.post.readOriginal}
          </Link>
        </span>
      </p>
    );
  }
  return null;
}

function AdjacentPosts({
  lang,
  dict,
  newer,
  older,
}: {
  lang: Locale;
  dict: Dictionary;
  newer: PostSummary | null;
  older: PostSummary | null;
}) {
  if (!newer && !older) return null;
  const item = (post: PostSummary, label: string, direction: "prev" | "next") => (
    <Link
      href={`/${lang}/posts/${post.slug}`}
      rel={direction}
      className={`group flex h-full flex-col gap-2 rounded-2xl border border-border p-5 transition-[background-color,border-color,transform] duration-500 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-hover ${direction === "next" ? "sm:items-end sm:text-right" : ""}`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] text-fg-subtle uppercase">
        {direction === "prev" && <ArrowLeft aria-hidden className="size-3.5" />}
        {label}
        {direction === "next" && <ArrowRight aria-hidden className="size-3.5" />}
      </span>
      <span lang={post.locale} className="font-serif text-lg leading-snug font-semibold text-fg-strong text-balance">
        {post.title}
      </span>
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

function blogPostingLd(post: PostDetail, lang: Locale, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    inLanguage: localeTags[post.locale],
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: site.author, url: absoluteUrl(`/${lang}`) },
    publisher: { "@type": "Person", name: site.author },
    image: post.cover ? [post.cover.url] : undefined,
    keywords: post.tags.map((t) => t.name).join(", ") || undefined,
    ...(post.locale !== post.sourceLocale && post.isMachineTranslated
      ? { translationOfWork: { "@id": absoluteUrl(localePath(post.sourceLocale, `/posts/${post.slug}`)) } }
      : {}),
    isPartOf: { "@type": "Blog", name: site.name, url: absoluteUrl(`/${lang}`) },
  };
}
