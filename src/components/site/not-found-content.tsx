import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** The 404 message, shared by the site's not-found page and the app-wide global-not-found page. */
export function NotFoundContent() {
  const dict = getDictionary();
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-8 text-center sm:pt-32 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
      <p className="site-label site-label-accent">{dict.notFound.eyebrow}</p>
      <h1 className="mt-4 font-serif text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.25rem]">
        {dict.notFound.title}
      </h1>
      <p className="mt-5 max-w-[46ch] font-serif text-xl text-fg-muted italic text-pretty">{dict.notFound.text}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="pill"
        >
          {dict.notFound.home}
        </Link>
        <Link
          href="/search"
          className="pill pill-ghost"
        >
          {dict.notFound.search}
        </Link>
      </div>
    </div>
  );
}
