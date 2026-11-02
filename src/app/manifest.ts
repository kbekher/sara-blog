import type { MetadataRoute } from "next";
import { siteLocale } from "@/lib/i18n/config";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.description,
    lang: siteLocale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#142030",
    theme_color: "#142030",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
