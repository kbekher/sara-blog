"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";

/**
 * Compact menu for small screens. The panel content is passed in as server-rendered children;
 * it closes on link click, Escape, or a click outside.
 */
export function MobileMenu({
  labels,
  children,
}: {
  labels: { open: string; close: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function onPanelClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <div ref={rootRef} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-300 ease-apple hover:bg-surface-hover hover:text-fg-strong md:size-10"
      >
        {open ? <X aria-hidden className="size-5" strokeWidth={1.75} /> : <Menu aria-hidden className="size-5" strokeWidth={1.75} />}
      </button>
      <div
        id={panelId}
        hidden={!open}
        onClick={onPanelClick}
        className={clsx(
          "absolute inset-x-3 top-[calc(100%+0.5rem)] rounded-2xl border border-border bg-bg-elevated p-3 shadow-(--shadow-lg)",
          "motion-safe:animate-[menu-in_280ms_var(--ease-out-expo)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
