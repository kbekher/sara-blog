import type { ReactNode } from "react";
import clsx from "clsx";

/** Page heading block: small eyebrow, big serif title, optional lead text. */
export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("motion-safe:animate-[fade-up_700ms_var(--ease-out-expo)_both]", className)}>
      {eyebrow && <p className="mb-3 text-xs font-medium tracking-[0.14em] text-accent uppercase">{eyebrow}</p>}
      <h1 className="font-serif text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.25rem]">
        {title}
      </h1>
      {lead && <p className="mt-4 max-w-[52ch] text-lg text-fg-muted text-pretty">{lead}</p>}
      {children}
    </header>
  );
}
