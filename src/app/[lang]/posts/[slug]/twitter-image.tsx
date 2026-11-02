import { defaultLocale } from "@/lib/i18n/config";
import { site } from "@/lib/site";
import { OG_SIZE } from "../../_lib/og";
import OpenGraphImage from "./opengraph-image";

/** Static (not per-locale) alt text — the default locale's blog name. */
export const alt = site.name[defaultLocale];
export const size = OG_SIZE;
export const contentType = "image/png";

export default OpenGraphImage;
