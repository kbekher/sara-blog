import { ImageResponse } from "next/og";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/get-dictionary";
import { getPostBySlug } from "@/lib/posts/public-queries";
import { site } from "@/lib/site";
import { loadCoverDataUrl, loadOgFonts, OG_SIZE, OgCard } from "../../_lib/og";

export const alt = site.name;
export const size = OG_SIZE;
export const contentType = "image/png";

/** Post card: cover photo (if any) under a dark gradient, serif title, blog name · date. */
export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const locale = isLocale(lang) ? lang : defaultLocale;
  const post = await getPostBySlug(locale, slug);

  const title = post?.title ?? site.name;
  const eyebrow = post ? `${site.name} · ${formatDate(locale, post.publishedAt)}` : site.name;
  const [fonts, cover] = await Promise.all([
    loadOgFonts(`${eyebrow}${title}`),
    post?.cover ? loadCoverDataUrl(post.cover.url) : Promise.resolve(null),
  ]);

  return new ImageResponse(<OgCard eyebrow={eyebrow} title={title} cover={cover} />, { ...OG_SIZE, fonts });
}
