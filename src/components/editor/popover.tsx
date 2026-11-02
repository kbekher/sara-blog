"use client";
/**
 * Floating panel anchored to an element or a viewport rect, rendered in a portal (so scrolling toolbars
 * don't clip it). Positioned with @floating-ui/dom; Esc and outside clicks close it; focus returns to the anchor.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, computePosition, flip, offset, shift, type Placement, type VirtualElement } from "@floating-ui/dom";
import { clsx } from "clsx";

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  /** Alternative to anchorRef: a viewport rect (e.g. a text range). */
  anchorRect?: { left: number; top: number; bottom: number; width?: number } | null;
  placement?: Placement;
  children: ReactNode;
  className?: string;
  label: string;
  /** Return focus to the anchor when closing (default true). */
  restoreFocus?: boolean;
};

export function Popover({
  open,
  onClose,
  anchorRef,
  anchorRect,
  placement = "bottom-start",
  children,
  className,
  label,
  restoreFocus = true,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const floating = ref.current;
    if (!open || !floating) return;
    const reference: Element | VirtualElement | null =
      anchorRef?.current ??
      (anchorRect
        ? {
            getBoundingClientRect: () => {
              const w = anchorRect.width ?? 0;
              return {
                x: anchorRect.left,
                y: anchorRect.top,
                left: anchorRect.left,
                top: anchorRect.top,
                right: anchorRect.left + w,
                bottom: anchorRect.bottom,
                width: w,
                height: anchorRect.bottom - anchorRect.top,
              } as DOMRect;
            },
          }
        : null);
    if (!reference) return;
    const update = () =>
      computePosition(reference, floating, {
        placement,
        strategy: "fixed",
        middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
      }).then(({ x, y }) => {
        floating.style.left = `${x}px`;
        floating.style.top = `${y}px`;
        floating.style.visibility = "visible";
      });
    if ("nodeType" in reference) return autoUpdate(reference, floating, update);
    void update();
    return undefined;
  }, [open, anchorRef, anchorRect, placement]);

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef?.current ?? null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        if (restoreFocus) anchor?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, anchorRef, restoreFocus]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={clsx("editor-popover", className)}
      style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}
