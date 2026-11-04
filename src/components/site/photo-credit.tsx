import clsx from "clsx";
import type { CoverImage } from "@/db/schema";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const UNSPLASH_UTM = "utm_source=sara_blog&utm_medium=referral";

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;
}

const linkClass = "underline decoration-border-strong underline-offset-2 transition-colors hover:text-fg-muted";

/** Required Unsplash attribution ("Фото: Name на Unsplash"); renders nothing for uploads / missing credits. */
export function PhotoCredit({ cover, dict, className }: { cover: CoverImage; dict: Dictionary; className?: string }) {
  if (cover.source !== "unsplash" || !cover.credit) return null;
  return (
    <figcaption className={clsx("text-[0.8125rem] text-fg-subtle", className)}>
      {dict.post.photoCredit.before}
      <a href={withUtm(cover.credit.profileUrl)} className={linkClass}>
        {cover.credit.name}
      </a>
      {dict.post.photoCredit.middle}
      <a href={withUtm("https://unsplash.com/")} className={linkClass}>
        Unsplash
      </a>
      {dict.post.photoCredit.after}
    </figcaption>
  );
}
