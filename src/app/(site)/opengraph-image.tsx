import { ImageResponse } from "next/og";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { site } from "@/lib/site";
import { loadOgFonts, OG_SIZE, OgCard } from "./_lib/og";

export const alt = site.name;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const title = site.name;
  const subtitle = site.description;
  const eyebrow = getDictionary().home.eyebrow;

  return new ImageResponse(<OgCard eyebrow={eyebrow} title={title} subtitle={subtitle} brandTitle />, {
    ...OG_SIZE,
    fonts: await loadOgFonts(`${eyebrow}${title}${subtitle}`),
  });
}
