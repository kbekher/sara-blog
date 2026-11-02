import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { fmt, getDictionary, plural } from "@/lib/i18n/get-dictionary";
import { getPostsByTag } from "@/lib/posts/public-queries";
import { PageIntro } from "@/components/site/page-intro";
import { PostGrid } from "@/components/site/post-card";
import { PageSkeleton } from "@/components/site/skeletons";
import { pageAlternates } from "../../_lib/seo";

export async function generateMetadata({ params }: PageProps<"/tags/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPostsByTag(slug);
  if (!data) return { robots: { index: false } };
  const dict = getDictionary();
  return {
    title: fmt(dict.meta.tagTitle, { tag: data.tag.name }),
    description: fmt(dict.meta.tagDescription, { tag: data.tag.name }),
    alternates: pageAlternates(`/tags/${data.tag.slug}`),
  };
}

export default function TagPage({ params }: PageProps<"/tags/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TagContent params={params} />
    </Suspense>
  );
}

async function TagContent({ params }: { params: PageProps<"/tags/[slug]">["params"] }) {
  const { slug } = await params;
  const data = await getPostsByTag(slug);
  if (!data || data.posts.length === 0) notFound();
  const dict = getDictionary();

  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
      <Link
        href="/tags"
        className="group inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-300 hover:text-fg-strong"
      >
        <ArrowLeft aria-hidden className="size-4 transition-transform duration-300 ease-apple group-hover:-translate-x-0.5" />
        <span>{dict.tags.allTags}</span>
      </Link>
      <PageIntro
        className="mt-8"
        eyebrow={dict.tags.taggedEyebrow}
        title={data.tag.name}
        lead={plural(data.posts.length, dict.tags.count)}
      />
      <PostGrid className="mt-12" dict={dict} posts={data.posts} />
    </div>
  );
}
