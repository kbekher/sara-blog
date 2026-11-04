import clsx from "clsx";
import type { PostSummary } from "@/lib/posts/public-queries";
import { CoverImage, RemoteImage } from "./cover-image";

/**
 * One of a post's summary images (`post.images[index]`) filling a positioned frame. The cover keeps its alt and
 * blur placeholder; body images are decorative here (the post title next to them names the link).
 * `tone`: "duo" = duotone on the theme accent, "bw" = greyscale that regains colour on hover.
 */
export function PostImage({
  post,
  index = 0,
  tone,
  sizes,
  priority,
  className,
}: {
  post: PostSummary;
  index?: number;
  tone: "duo" | "bw";
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = post.images[index];
  if (!src) return null;
  const isCover = post.cover?.url === src;
  return (
    <div
      className={clsx(
        "relative overflow-hidden bg-bg-sunken",
        tone === "duo" ? "duotone" : "bw",
        className,
      )}
    >
      {isCover && post.cover ? (
        <CoverImage cover={{ ...post.cover, alt: "" }} sizes={sizes} priority={priority} />
      ) : (
        <RemoteImage src={src} sizes={sizes} priority={priority} />
      )}
    </div>
  );
}
