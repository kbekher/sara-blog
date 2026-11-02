import type { Metadata } from "next";
import { Hash } from "lucide-react";
import { getDictionary, plural } from "@/lib/i18n/get-dictionary";
import { getAllTags } from "@/lib/posts/public-queries";
import { PageIntro } from "@/components/site/page-intro";
import { TagChip } from "@/components/site/tag-chip";
import { EmptyState } from "@/components/site/empty-state";
import { pageAlternates } from "../_lib/seo";

const dict = getDictionary();

export const metadata: Metadata = {
  title: dict.meta.tagsTitle,
  description: dict.meta.tagsDescription,
  alternates: pageAlternates("/tags"),
};

export default async function TagsPage() {
  const tags = await getAllTags();

  return (
    <div className="mx-auto max-w-4xl px-5 pt-16 sm:px-8 sm:pt-24">
      <PageIntro title={dict.tags.title} lead={dict.tags.intro} />
      {tags.length === 0 ? (
        <EmptyState
          className="mt-14"
          title={dict.tags.emptyTitle}
          text={dict.tags.emptyText}
          icon={<Hash aria-hidden className="size-5" strokeWidth={1.75} />}
        />
      ) : (
        <ul className="mt-12 flex flex-wrap gap-3 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_120ms_both]">
          {tags.map((tag) => (
            <li key={tag.slug}>
              <TagChip tag={tag} size="lg" count={plural(tag.count, dict.tags.count)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
