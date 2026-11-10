"use client";

import { useLayoutEffect } from "react";

/**
 * Route transitions can land a few pixels down (sticky header + overflowing decorative layers).
 * Snap the window to the top once the post page commits, with instant behavior so CSS
 * `scroll-behavior` cannot animate us partway.
 */
export function ScrollToTop() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  return null;
}
