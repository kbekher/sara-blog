"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

/** Sticky glass header shell; the hairline border fades in once the page is scrolled. */
export function HeaderFrame({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 4);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={clsx(
        "sticky top-0 z-40 border-b bg-(--glass) backdrop-blur-xl backdrop-saturate-150",
        "transition-[border-color,background-color] duration-500 ease-apple",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      {children}
    </header>
  );
}
