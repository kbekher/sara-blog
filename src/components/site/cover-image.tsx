"use client";

import Image, { type ImageLoaderProps } from "next/image";
import clsx from "clsx";
import type { CoverImage as Cover } from "@/db/schema";

/**
 * Unsplash requires hotlinking its CDN (images.unsplash.com, an imgix endpoint), so Unsplash covers are
 * resized by imgix URL params instead of being proxied through the Next.js image optimizer.
 */
function unsplashLoader({ src, width, quality }: ImageLoaderProps): string {
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 75));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  return url.toString();
}

/** Plain URL check, not a security boundary: only picks the loader. */
function isUnsplash(src: string): boolean {
  try {
    return new URL(src).hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

/**
 * Cover image that fills its (positioned, aspect-ratio'd) parent. Shows `cover.color` as the placeholder
 * background, or `cover.blurDataURL` as a blur-up when available.
 */
export function CoverImage({
  cover,
  sizes,
  priority = false,
  className,
}: {
  cover: Cover;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={cover.url}
      alt={cover.alt}
      fill
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      loader={isUnsplash(cover.url) ? unsplashLoader : undefined}
      placeholder={cover.blurDataURL ? "blur" : "empty"}
      blurDataURL={cover.blurDataURL}
      className={clsx("object-cover", className)}
    />
  );
}
