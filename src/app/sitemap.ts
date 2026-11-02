import type { MetadataRoute } from "next";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";
import { getAllPublishedSlugs } from "@/lib/posts/public-queries";
import { absoluteUrl, localePath } from "./[lang]/_lib/seo";

function languages(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of locales) map[l] = absoluteUrl(localePath(l, path));
  map["x-default"] = absoluteUrl(localePath(defaultLocale, path));
  return map;
}

function entries(
  path: string,
  options: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
): MetadataRoute.Sitemap {
  return locales.map((l: Locale) => ({
    url: absoluteUrl(localePath(l, path)),
    alternates: { languages: languages(path) },
    ...options,
  }));
}

/** Every public page in every locale, each with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPublishedSlugs();
  const latest = posts.reduce<Date | undefined>(
    (max, p) => (!max || p.updatedAt > max ? p.updatedAt : max),
    undefined,
  );

  return [
    ...entries("", { lastModified: latest, changeFrequency: "daily", priority: 1 }),
    ...entries("/tags", { lastModified: latest, changeFrequency: "weekly", priority: 0.4 }),
    ...posts.flatMap((p) =>
      entries(`/posts/${p.slug}`, { lastModified: p.updatedAt, changeFrequency: "monthly", priority: 0.8 }),
    ),
  ];
}
