import type { MetadataRoute } from "next";
import { defaultLocale } from "@/lib/i18n/config";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name[defaultLocale],
    short_name: site.name[defaultLocale],
    description: site.description[defaultLocale],
    lang: defaultLocale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
