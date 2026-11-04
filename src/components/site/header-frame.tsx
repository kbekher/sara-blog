"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Sticky glass header shell; the hairline border fades in once the page is scrolled.
 *
 * On the home page the header wears the hero band's colours (see `.on-band` in globals.css): CSS picks that up
 * before hydration via `html:has([data-hero-band])`; here `data-over-band` turns it off once the band has scrolled
 * out from under the header, so the bar matches whatever surface it floats over.
 */
export function HeaderFrame({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [overBand, setOverBand] = useState<boolean | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 4);
      const band = document.querySelector("[data-hero-band]");
      if (!band) {
        setOverBand(null);
        return;
      }
      const headerHeight = ref.current?.offsetHeight ?? 0;
      setOverBand(band.getBoundingClientRect().bottom > headerHeight / 2);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Client navigations swap the page under a persistent header: re-check when the main content changes.
    const main = document.getElementById("main");
    const observer = main ? new MutationObserver(onScroll) : null;
    if (main) observer?.observe(main, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      ref={ref}
      data-scrolled={scrolled || undefined}
      data-over-band={overBand === null ? undefined : String(overBand)}
      className={clsx(
        "site-header sticky top-0 z-40 border-b bg-(--glass) text-fg backdrop-blur-xl backdrop-saturate-150",
        "transition-[border-color,background-color,color] duration-500 ease-apple",
        scrolled && overBand !== true ? "border-border" : "border-transparent",
      )}
    >
      {children}
    </header>
  );
}
