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
      {eyebrow && <p className="site-label site-label-accent mb-4">{eyebrow}</p>}
      <h1 className="font-serif text-[2.5rem] leading-[1.06] font-semibold tracking-[-0.02em] text-fg-strong text-balance sm:text-[3.5rem]">
        {title}
      </h1>
      {lead && <p className="mt-4 max-w-[52ch] font-serif text-xl text-fg-muted italic text-pretty">{lead}</p>}
      {children}
    </header>
  );
}
