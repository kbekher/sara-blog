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
      <p className="site-label site-label-accent">{t.eyebrow}</p>
      <h1 className="mt-4 font-serif text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.25rem]">
        {t.title}
      </h1>
      <p className="mt-5 max-w-[46ch] font-serif text-xl text-fg-muted italic text-pretty">{t.text}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="pill"
        >
          <RotateCcw aria-hidden className="size-4" />
          <span>{t.retry}</span>
        </button>
        <Link
          href="/"
          className="pill pill-ghost"
        >
          {t.home}
        </Link>
      </div>
    </div>
  );
}
