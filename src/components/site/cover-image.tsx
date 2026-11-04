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

/** Hosts allowed in next.config `images.remotePatterns` (served by the Next.js optimizer). */
function isOptimizable(src: string): boolean {
  try {
    const { protocol, hostname } = new URL(src);
    return (
      protocol === "https:" &&
      (hostname === "plus.unsplash.com" || hostname.endsWith(".public.blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

/**
 * Any https image URL (e.g. one found in a post body) filling its positioned parent: Unsplash via the imgix loader,
 * Blob uploads via the Next.js optimizer, anything else as a plain lazy <img> (unknown hosts are not in
 * remotePatterns). The parent sets the size, so there is no layout shift.
 */
export function RemoteImage({
  src,
  alt = "",
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (isUnsplash(src) || isOptimizable(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        loader={isUnsplash(src) ? unsplashLoader : undefined}
        className={clsx("object-cover", className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- host outside images.remotePatterns
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={clsx("absolute inset-0 size-full object-cover", className)}
    />
  );
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
