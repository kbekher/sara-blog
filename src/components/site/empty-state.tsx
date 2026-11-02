import type { ReactNode } from "react";
import clsx from "clsx";

export function EmptyState({
  title,
  text,
  icon,
  children,
  className,
}: {
  title: string;
  text: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center rounded-3xl border border-dashed border-border-strong px-6 py-16 text-center sm:py-20",
        className,
      )}
    >
      {icon && (
        <div className="mb-5 inline-flex size-12 items-center justify-center rounded-full bg-surface text-fg-muted">
          {icon}
        </div>
      )}
      <h2 className="font-serif text-2xl font-semibold text-fg-strong text-balance">{title}</h2>
      <p className="mt-3 max-w-[46ch] text-fg-muted text-pretty">{text}</p>
      {children && <div className="mt-7 w-full max-w-lg">{children}</div>}
    </div>
  );
}
