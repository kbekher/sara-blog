import Link from "next/link";
import { lang } from "next/root-params";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function NotFound() {
  const value = await lang();
  const locale = isLocale(value) ? value : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-8 text-center sm:pt-32 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
      <p className="text-xs font-medium tracking-[0.14em] text-accent uppercase">{dict.notFound.eyebrow}</p>
      <h1 className="mt-4 font-serif text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.25rem]">
        {dict.notFound.title}
      </h1>
      <p className="mt-5 max-w-[46ch] text-lg text-fg-muted text-pretty">{dict.notFound.text}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href={`/${locale}`}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5.5 text-[0.9375rem] font-medium text-accent-fg transition-colors duration-300 hover:bg-accent-hover"
        >
          {dict.notFound.home}
        </Link>
        <Link
          href={`/${locale}/search`}
          className="inline-flex h-11 items-center rounded-full border border-border-strong px-5.5 text-[0.9375rem] text-fg transition-colors duration-300 hover:bg-surface-hover"
        >
          {dict.notFound.search}
        </Link>
      </div>
    </div>
  );
}
