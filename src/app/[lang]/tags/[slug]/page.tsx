import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { fmt, getDictionary, plural } from "@/lib/i18n/get-dictionary";
import { getPostsByTag } from "@/lib/posts/public-queries";
import { PageIntro } from "@/components/site/page-intro";
import { PostGrid } from "@/components/site/post-card";
import { PageSkeleton } from "@/components/site/skeletons";
import { pageAlternates } from "../../_lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/tags/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const data = await getPostsByTag(lang, slug);
  if (!data) return { robots: { index: false } };
  const dict = getDictionary(lang);
  return {
    title: fmt(dict.meta.tagTitle, { tag: data.tag.name }),
    description: fmt(dict.meta.tagDescription, { tag: data.tag.name }),
    alternates: pageAlternates(lang, `/tags/${data.tag.slug}`),
  };
}

export default function TagPage({ params }: PageProps<"/[lang]/tags/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TagContent params={params} />
    </Suspense>
  );
}

async function TagContent({ params }: { params: PageProps<"/[lang]/tags/[slug]">["params"] }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const data = await getPostsByTag(lang, slug);
  if (!data || data.posts.length === 0) notFound();
  const dict = getDictionary(lang);

  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
      <Link
        href={`/${lang}/tags`}
        className="group inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-300 hover:text-fg-strong"
      >
        <ArrowLeft aria-hidden className="size-4 transition-transform duration-300 ease-apple group-hover:-translate-x-0.5" />
        {dict.tags.allTags}
      </Link>
      <PageIntro
        className="mt-8"
        eyebrow={dict.tags.taggedEyebrow}
        title={data.tag.name}
        lead={plural(lang, data.posts.length, dict.tags.count)}
      />
      <PostGrid className="mt-12" locale={lang} dict={dict} posts={data.posts} />
    </div>
  );
}
