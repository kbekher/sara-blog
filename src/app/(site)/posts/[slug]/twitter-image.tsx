import { site } from "@/lib/site";
import { OG_SIZE } from "../../_lib/og";
import OpenGraphImage from "./opengraph-image";

export const alt = site.name;
export const size = OG_SIZE;
export const contentType = "image/png";

export default OpenGraphImage;
