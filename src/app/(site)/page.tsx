import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Feather } from "lucide-react";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { getFeaturedPost, getPublishedPosts } from "@/lib/posts/public-queries";
import { site } from "@/lib/site";
import { HeroPostCard, PostGrid } from "@/components/site/post-card";
import { Pagination } from "@/components/site/pagination";
import { EmptyState } from "@/components/site/empty-state";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { PostGridSkeleton } from "@/components/site/skeletons";
import { pageAlternates } from "./_lib/seo";

export const metadata: Metadata = { alternates: pageAlternates("/") };

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const dict = getDictionary();
  const hero = await getFeaturedPost();

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <header className="pt-16 pb-12 sm:pt-24 sm:pb-16 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
        <p className="mb-4 text-xs font-medium tracking-[0.14em] text-accent uppercase">{dict.home.eyebrow}</p>
        <h1 className="font-serif text-[2.75rem] leading-[1.04] font-semibold tracking-[-0.025em] text-fg-strong text-balance sm:text-[4rem]">
          {site.name}
        </h1>
        <p className="mt-5 max-w-[34ch] font-serif text-xl leading-snug text-fg-muted italic text-pretty sm:text-2xl">
          {site.description}
        </p>
      </header>

      {hero ? (
        <>
          <section
            aria-label={dict.home.featured}
            className="motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_120ms_both]"
          >
            <HeroPostCard dict={dict} post={hero} />
          </section>
          <Suspense fallback={<MorePostsFallback dict={dict} />}>
            <MorePosts dict={dict} heroSlug={hero.slug} searchParams={searchParams} />
          </Suspense>
        </>
      ) : (
        <EmptyState
          title={dict.home.emptyTitle}
          text={dict.home.emptyText}
          icon={<Feather aria-hidden className="size-5" strokeWidth={1.75} />}
        >
          <NewsletterForm labels={dict.newsletter} variant="inline" className="text-left" />
        </EmptyState>
      )}
    </div>
  );
}

function MorePostsHeading({ dict }: { dict: Dictionary }) {
  return (
    <h2 id="more-posts" className="mb-8 font-serif text-[1.75rem] font-semibold tracking-[-0.01em] text-fg-strong">
      {dict.home.morePosts}
    </h2>
  );
}

function MorePostsFallback({ dict }: { dict: Dictionary }) {
  return (
    <section className="mt-20 sm:mt-24">
      <MorePostsHeading dict={dict} />
      <PostGridSkeleton />
    </section>
  );
}

/** The paginated list (everything except the hero). Reads `?page`, so it streams inside Suspense. */
async function MorePosts({
  dict,
  heroSlug,
  searchParams,
}: {
  dict: Dictionary;
  heroSlug: string;
  searchParams: PageProps<"/">["searchParams"];
}) {
  const raw = (await searchParams).page;
  const page = Math.max(1, Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "1"), 10) || 1);
  const result = await getPublishedPosts({ page, excludeSlug: heroSlug });
  if (result.total === 0) return null;
  if (result.posts.length === 0 && page > 1) notFound();

  return (
    <section aria-labelledby="more-posts" className="mt-20 sm:mt-24">
      <MorePostsHeading dict={dict} />
      <PostGrid dict={dict} posts={result.posts} />
      <div className="mt-12">
        <Pagination basePath="/" page={result.page} pageCount={result.pageCount} dict={dict} />
      </div>
    </section>
  );
}
