import { ImageResponse } from "next/og";
import { formatDate } from "@/lib/i18n/get-dictionary";
import { getPostBySlug } from "@/lib/posts/public-queries";
import { site } from "@/lib/site";
import { loadCoverDataUrl, loadOgFonts, OG_SIZE, OgCard } from "../../_lib/og";

export const alt = site.name;
export const size = OG_SIZE;
export const contentType = "image/png";

/** Post card: cover photo (if any) under a dark gradient, serif title, blog name · date. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  const title = post?.title ?? site.name;
  const eyebrow = post ? `${site.name} · ${formatDate(post.publishedAt)}` : site.name;
  const [fonts, cover] = await Promise.all([
    loadOgFonts(`${eyebrow}${title}`),
    post?.cover ? loadCoverDataUrl(post.cover.url) : Promise.resolve(null),
  ]);

  return new ImageResponse(<OgCard eyebrow={eyebrow} title={title} cover={cover} />, { ...OG_SIZE, fonts });
}
