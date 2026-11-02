"use client";
/**
 * Tiny dependency-free toast system.
 *   <ToastProvider> once (admin layout), then `const toast = useToast(); toast.success("Сохранено")`.
 * Toasts are announced politely to screen readers, pause on hover, and can carry links / an action button.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { clsx } from "clsx";

type ToastKind = "success" | "error" | "info";

export type ToastOptions = {
  description?: ReactNode;
  /** ms; 0 = sticky until closed. Default 4500 (errors 8000). */
  duration?: number;
  action?: { label: string; onClick: () => void };
  links?: { label: string; href: string }[];
};

type ToastItem = ToastOptions & { id: number; kind: ToastKind; title: ReactNode; leaving?: boolean };

type ToastApi = {
  show: (kind: ToastKind, title: ReactNode, options?: ToastOptions) => number;
  success: (title: ReactNode, options?: ToastOptions) => number;
  error: (title: ReactNode, options?: ToastOptions) => number;
  info: (title: ReactNode, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 220);
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const arm = useCallback(
    (id: number, duration: number) => {
      if (duration <= 0) return;
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.set(
        id,
        setTimeout(() => remove(id), duration),
      );
    },
    [remove],
  );

  const show = useCallback(
    (kind: ToastKind, title: ReactNode, options: ToastOptions = {}) => {
      const id = nextId.current++;
      const duration = options.duration ?? (kind === "error" ? 8000 : options.links ? 9000 : 4500);
      setItems((list) => [...list.slice(-3), { ...options, duration, id, kind, title }]);
      arm(id, duration);
      return id;
    },
    [arm],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (t, o) => show("success", t, o),
      error: (t, o) => show("error", t, o),
      info: (t, o) => show("info", t, o),
      dismiss: remove,
    }),
    [show, remove],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {items.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              aria-live={t.kind === "error" ? "assertive" : "polite"}
              onMouseEnter={() => {
                const timer = timers.current.get(t.id);
                if (timer) clearTimeout(timer);
              }}
              onMouseLeave={() => arm(t.id, 2500)}
              className={clsx(
                "admin-toast pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border-strong bg-bg-elevated/95 px-4 py-3 text-sm text-fg shadow-[var(--shadow-lg)] backdrop-blur-xl",
                t.leaving && "admin-toast-leave",
              )}
            >
              <Icon
                aria-hidden
                className={clsx(
                  "mt-0.5 size-4 shrink-0",
                  t.kind === "success" && "text-[var(--tc-green)]",
                  t.kind === "error" && "text-[var(--tc-red)]",
                  t.kind === "info" && "text-accent",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-fg-strong">{t.title}</div>
                {t.description ? <div className="mt-0.5 text-fg-muted">{t.description}</div> : null}
                {t.links?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.links.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-border px-2.5 py-0.5 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
                      >
                        {l.label}
                      </a>
                    ))}
                  </div>
                ) : null}
                {t.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      remove(t.id);
                    }}
                    className="mt-2 text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    {t.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Закрыть уведомление"
                className="-mr-1 rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
