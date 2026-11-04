import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowDown, Feather } from "lucide-react";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { getLatestPosts, getPublishedPosts, type PostSummary } from "@/lib/posts/public-queries";
import { getSiteSettings } from "@/lib/site-settings";
import { site } from "@/lib/site";
import type { CoverImage as Cover } from "@/db/schema";
import { CoverImage } from "@/components/site/cover-image";
import { PostGrid } from "@/components/site/post-card";
import { SeriesRow } from "@/components/site/series-row";
import { Pagination } from "@/components/site/pagination";
import { EmptyState } from "@/components/site/empty-state";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { PhotoCredit } from "@/components/site/photo-credit";
import { PostGridSkeleton } from "@/components/site/skeletons";
import { pageAlternates } from "./_lib/seo";

export const metadata: Metadata = { alternates: pageAlternates("/") };

/** How many of the newest posts get a full "Последние записи" row; the rest go to the archive grid. */
const SERIES_COUNT = 3;

const WRAP = "mx-auto max-w-[75rem] px-5 sm:px-8 lg:px-12";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const dict = getDictionary();
  const [latest, settings] = await Promise.all([getLatestPosts(SERIES_COUNT), getSiteSettings()]);
  // Portrait: the one set in the admin, else the first latest post's cover, else no image column at all.
  const portrait = settings.heroPortrait ?? latest.find((p) => p.cover)?.cover ?? null;

  return (
    <>
      <HeroBand dict={dict} portrait={portrait} hasPosts={latest.length > 0} />

      <div className={WRAP}>
        {latest.length > 0 ? (
          <>
            <section
              id="latest"
              aria-labelledby="latest-title"
              className="scroll-mt-24 pt-16 sm:pt-24 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_120ms_both]"
            >
              <SectionTitle id="latest-title">{dict.home.latestPosts}</SectionTitle>
              <div className="flex flex-col gap-16 sm:gap-22">
                {latest.map((post, i) => (
                  <SeriesRow key={post.id} dict={dict} post={post} flip={i % 2 === 1} priority={i === 0 && !portrait} />
                ))}
              </div>
            </section>
            <Suspense fallback={<ArchiveFallback dict={dict} />}>
              <Archive dict={dict} exclude={latest.map((p) => p.slug)} searchParams={searchParams} />
            </Suspense>
          </>
        ) : (
          <div className="pt-16 sm:pt-24">
            <EmptyState
              title={dict.home.emptyTitle}
              text={dict.home.emptyText}
              icon={<Feather aria-hidden className="size-5" strokeWidth={1.75} />}
            >
              <div data-home-newsletter>
                <NewsletterForm labels={dict.newsletter} variant="inline" className="text-left" />
              </div>
            </EmptyState>
          </div>
        )}

        {latest.length > 0 && (
          <div data-home-newsletter className="mt-24 sm:mt-28">
            <NewsletterForm labels={dict.newsletter} variant="strip" />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Two-tone hero: the band is the page's inverse surface (`.on-band` remaps the tokens; `data-hero-band` also
 * tints the sticky header while the band is under it). Brand wordmark, CTA, two short text columns and a tall
 * duotone portrait; without a portrait the layout falls back to two balanced columns.
 */
function HeroBand({ dict, portrait, hasPosts }: { dict: Dictionary; portrait: Cover | null; hasPosts: boolean }) {
  const [first, ...rest] = site.name.split(" ");
  return (
    <section data-hero-band aria-labelledby="hero-title" className="on-band">
      <div
        className={`${WRAP} grid gap-8 pt-6 pb-10 sm:pt-10 sm:pb-16 lg:items-stretch lg:gap-10 ${
          portrait ? "lg:grid-cols-[1.35fr_0.9fr_0.85fr]" : "lg:grid-cols-[1.35fr_1fr]"
        }`}
      >
        <div className="flex flex-col motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
          <p className="site-label">{dict.home.eyebrow}</p>
          <h1
            id="hero-title"
            className="brand-wordmark mt-6 text-[3.625rem] leading-[0.92] text-fg-strong sm:text-[5rem] lg:mt-auto lg:text-[5.75rem] xl:text-[6.5rem]"
          >
            <span className="block">{first}</span>
            {rest.length > 0 && <span className="block">{rest.join(" ")}</span>}
          </h1>
          {hasPosts && (
            <div className="mt-7 lg:mb-auto">
              <a href="#latest" className="pill group">
                <span>{dict.home.heroCta}</span>
                <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
              </a>
            </div>
          )}
        </div>

        <div className="grid gap-4 text-[0.875rem] leading-[1.6] text-fg-muted sm:grid-cols-2 lg:flex lg:flex-col lg:justify-between lg:py-3 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_80ms_both]">
          <p className="max-w-[18rem] text-pretty">{site.description}</p>
          <p className="max-w-[18rem] text-pretty">{dict.home.heroNote}</p>
        </div>

        {portrait && (
          <figure className="motion-safe:animate-[fade-in_1000ms_var(--ease-apple)_150ms_both]">
            <div className="duotone relative h-[380px] overflow-hidden rounded-[1.125rem] sm:h-[460px] lg:h-[520px]">
              <CoverImage
                cover={{ ...portrait, alt: portrait.alt || dict.home.heroPortraitAlt }}
                priority
                sizes="(min-width: 1200px) 330px, (min-width: 1024px) 28vw, 100vw"
              />
            </div>
            <PhotoCredit cover={portrait} dict={dict} className="mt-2.5 text-left" />
          </figure>
        )}
      </div>
    </section>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-10 font-serif text-[1.625rem] leading-tight font-normal text-fg-strong sm:text-[1.875rem]">
      {children}
    </h2>
  );
}

function ArchiveFallback({ dict }: { dict: Dictionary }) {
  return (
    <section className="mt-24 sm:mt-28">
      <SectionTitle id="archive-title">{dict.home.archive}</SectionTitle>
      <PostGridSkeleton />
    </section>
  );
}

/** The paginated archive (everything except the "Последние записи" rows). Reads `?page`, so it streams in Suspense. */
async function Archive({
  dict,
  exclude,
  searchParams,
}: {
  dict: Dictionary;
  exclude: PostSummary["slug"][];
  searchParams: PageProps<"/">["searchParams"];
}) {
  const raw = (await searchParams).page;
  const page = Math.max(1, Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "1"), 10) || 1);
  const result = await getPublishedPosts({ page, excludeSlugs: exclude });
  if (result.total === 0) {
    if (page > 1) notFound();
    return null;
  }
  if (result.posts.length === 0 && page > 1) notFound();

  return (
    <section id="archive" aria-labelledby="archive-title" className="mt-24 scroll-mt-24 sm:mt-28">
      <SectionTitle id="archive-title">{dict.home.archive}</SectionTitle>
      <PostGrid dict={dict} posts={result.posts} />
      <div className="mt-12">
        <Pagination basePath="/" page={result.page} pageCount={result.pageCount} dict={dict} />
      </div>
    </section>
  );
}
