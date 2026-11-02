"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import ru from "@/lib/i18n/dictionaries/ru";

// Only the small `error` slice of the dictionary is needed here.
const t = ru.error;

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-8 text-center sm:pt-32 motion-safe:animate-[fade-up_800ms_var(--ease-out-expo)_both]">
      <p className="text-xs font-medium tracking-[0.14em] text-accent uppercase">{t.eyebrow}</p>
      <h1 className="mt-4 font-serif text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.25rem]">
        {t.title}
      </h1>
      <p className="mt-5 max-w-[46ch] text-lg text-fg-muted text-pretty">{t.text}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5.5 text-[0.9375rem] font-medium text-accent-fg transition-colors duration-300 hover:bg-accent-hover"
        >
          <RotateCcw aria-hidden className="size-4" />
          <span>{t.retry}</span>
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full border border-border-strong px-5.5 text-[0.9375rem] text-fg transition-colors duration-300 hover:bg-surface-hover"
        >
          {t.home}
        </Link>
      </div>
    </div>
  );
}
