import { ImageResponse } from "next/og";
import { isLocale, defaultLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { loadOgFonts, OG_SIZE, OgCard } from "./_lib/og";

export const alt = site.name;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : defaultLocale;
  const dict = getDictionary(locale);
  const title = site.name;
  const subtitle = site.description[locale];
  const eyebrow = dict.home.eyebrow;

  return new ImageResponse(<OgCard eyebrow={eyebrow} title={title} subtitle={subtitle} />, {
    ...OG_SIZE,
    fonts: await loadOgFonts(`${eyebrow}${title}${subtitle}`),
  });
}
