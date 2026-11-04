import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { fmt, getDictionary, plural, type Dictionary } from "@/lib/i18n/get-dictionary";
import { searchPosts } from "@/lib/posts/public-queries";
import { PageIntro } from "@/components/site/page-intro";
import { SearchField, SearchInput } from "@/components/site/search-input";
import { PostLabel } from "@/components/site/post-label";
import { Highlight } from "@/components/site/highlight";
import { EmptyState } from "@/components/site/empty-state";
import { ListSkeleton } from "@/components/site/skeletons";
import { pageAlternates } from "../_lib/seo";

const dict = getDictionary();

export const metadata: Metadata = {
  title: dict.meta.searchTitle,
  description: dict.meta.searchDescription,
  alternates: pageAlternates("/search"),
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  const labels = {
    label: dict.search.label,
    placeholder: dict.search.placeholder,
    clear: dict.search.clear,
    searching: dict.search.searching,
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pt-14 sm:px-8 sm:pt-20">
      <PageIntro title={dict.search.title} />
      <div className="mt-10">
        <Suspense fallback={<SearchField labels={labels} />}>
          <SearchInput labels={labels} />
        </Suspense>
      </div>
      <div className="mt-10">
        <Suspense fallback={<ListSkeleton />}>
          <SearchResults dict={dict} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function SearchResults({
  dict,
  searchParams,
}: {
  dict: Dictionary;
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();

  if (query.length < 2) {
    return <p className="text-fg-muted text-pretty">{dict.search.hint}</p>;
  }

  const results = await searchPosts(query);

  if (results.length === 0) {
    return (
      <EmptyState
        title={dict.search.noResultsTitle}
        text={fmt(dict.search.noResultsText, { q: query })}
        icon={<SearchX aria-hidden className="size-5" strokeWidth={1.75} />}
      >
        <Link
          href="/tags"
          className="pill pill-ghost"
        >
          {dict.nav.tags}
        </Link>
      </EmptyState>
    );
  }

  return (
    <section aria-live="polite">
      <p className="site-label mb-6">{plural(results.length, dict.search.results)}</p>
      <ol className="divide-y divide-border border-y border-border">
        {results.map((post, i) => (
          <li
            key={post.id}
            className="motion-safe:animate-[fade-up_600ms_var(--ease-out-expo)_both]"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <Link
              href={`/posts/${post.slug}`}
              className="group -mx-4 block rounded-2xl px-4 py-6 transition-colors duration-300 hover:bg-surface"
            >
              <PostLabel publishedAt={post.publishedAt} location={post.location} readingMinutes={post.readingMinutes} dict={dict} />
              <h2 className="mt-2.5 font-serif text-[1.5rem] leading-snug text-fg-strong italic text-balance transition-colors duration-300 group-hover:text-accent">
                <Highlight text={post.title} query={query} />
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-muted text-pretty">
                <Highlight text={post.snippet} query={query} />
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
