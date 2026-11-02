"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Link2, Share } from "lucide-react";
import clsx from "clsx";

export type ShareLabels = { share: string; shareNative: string; copyLink: string; copied: string; copyFailed: string };

const noopSubscribe = () => () => {};

const buttonClass =
  "inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm text-fg transition-[background-color,border-color,color] duration-300 ease-apple hover:border-border-strong hover:bg-surface-hover hover:text-fg-strong";

/**
 * Copy-link + native share sheet (shown only where navigator.share exists).
 * The copy feedback text is a keyed element, so a browser-translated page gets a fresh node to translate instead of
 * React editing a text node the translator has replaced (see translate-guard.tsx).
 */
export function ShareButtons({ url, title, labels }: { url: string; title: string; labels: ShareLabels }) {
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 2200);
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className={buttonClass}>
        {copyState === "copied" ? (
          <Check aria-hidden className="size-4 text-accent" />
        ) : (
          <Link2 aria-hidden className="size-4" />
        )}
        <span key={copyState} className={clsx(copyState === "failed" && "text-(--tc-red)")}>
          {copyState === "copied" ? labels.copied : copyState === "failed" ? labels.copyFailed : labels.copyLink}
        </span>
      </button>
      {canShare && (
        <button type="button" onClick={share} className={buttonClass}>
          <Share aria-hidden className="size-4" />
          <span>{labels.shareNative}</span>
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {copyState !== "idle" && <span key={copyState}>{copyState === "copied" ? labels.copied : labels.copyFailed}</span>}
      </span>
    </div>
  );
}
