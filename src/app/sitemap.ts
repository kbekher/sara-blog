import type { MetadataRoute } from "next";
import { getAllPublishedSlugs } from "@/lib/posts/public-queries";
import { absoluteUrl } from "./(site)/_lib/seo";

/** Every public page. The site is Russian-only (browser translation covers other languages), so no hreflang. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPublishedSlugs();
  const latest = posts.reduce<Date | undefined>(
    (max, p) => (!max || p.updatedAt > max ? p.updatedAt : max),
    undefined,
  );

  return [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/tags"), lastModified: latest, changeFrequency: "weekly", priority: 0.4 },
    ...posts.map((p) => ({
      url: absoluteUrl(`/posts/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
