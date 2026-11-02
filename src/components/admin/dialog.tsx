"use client";
/**
 * Accessible modal built on the native <dialog> element:
 *  - showModal() makes the rest of the page inert (focus is trapped inside),
 *  - Esc closes (the `cancel` event), a click on the backdrop closes,
 *  - focus moves to the first focusable control (or [data-autofocus]) and is restored on close.
 * Variants: centered "modal" or right-side "sheet" (slide-over).
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "modal" | "sheet";
  size?: "sm" | "md" | "lg" | "xl";
  /** Hide the visible title (still announced to screen readers). */
  hideTitle?: boolean;
  className?: string;
  bodyClassName?: string;
};

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-6xl" } as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "modal",
  size = "md",
  hideTitle,
  className,
  bodyClassName,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      restoreFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      document.documentElement.classList.add("admin-scroll-lock");
      const target =
        dialog.querySelector<HTMLElement>("[data-autofocus]") ??
        dialog.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ) ??
        dialog.querySelector<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])");
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) {
      document.documentElement.classList.remove("admin-scroll-lock");
      const el = restoreFocus.current;
      restoreFocus.current = null;
      if (el && document.contains(el)) el.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    return () => document.documentElement.classList.remove("admin-scroll-lock");
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onMouseDown={(e) => {
        // Backdrop click: the event target is the <dialog> itself (content is wrapped in a div).
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
      className={clsx("admin-dialog", variant === "sheet" ? "admin-sheet" : clsx("admin-modal", SIZES[size]), className)}
    >
      {open ? (
        <div className="flex max-h-[inherit] min-h-0 flex-col">
          <header className="flex items-start gap-4 px-6 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className={clsx("font-serif text-xl font-semibold text-fg-strong", hideTitle && "sr-only")}
              >
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              aria-label="Закрыть"
              className="-mr-2 rounded-full p-2 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className={clsx("min-h-0 flex-1 overflow-y-auto px-6 pb-6", bodyClassName)}>{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Small confirm dialog. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} data-autofocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={clsx("admin-btn", danger ? "admin-btn-danger" : "admin-btn-primary")}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Dialog>
  );
}
