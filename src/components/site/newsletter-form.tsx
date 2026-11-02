"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import clsx from "clsx";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export type NewsletterLabels = Dictionary["newsletter"];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; doubleOptIn: boolean }
  | { status: "error"; message: string };

type ApiResponse = { ok: true; doubleOptIn: boolean } | { ok: false; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Newsletter signup. POSTs JSON `{ email, locale, company }` to /api/newsletter
 * (`company` is a honeypot: humans never see or fill it). Expects `{ ok: true, doubleOptIn }`
 * or `{ ok: false, error }` with a 4xx status.
 */
export function NewsletterForm({
  locale,
  labels,
  variant = "card",
  className,
}: {
  locale: Locale;
  labels: NewsletterLabels;
  variant?: "card" | "inline";
  className?: string;
}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const id = useId();
  const emailId = `${id}-email`;
  const statusId = `${id}-status`;
  const titleId = `${id}-title`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "loading") return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const company = String(data.get("company") ?? "");

    if (!EMAIL_RE.test(email)) {
      setState({ status: "error", message: labels.errorInvalid });
      return;
    }

    setState({ status: "loading" });
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, company }),
      });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (res.ok && body?.ok) {
        setState({ status: "success", doubleOptIn: body.doubleOptIn });
        return;
      }
      const message =
        res.status === 429
          ? labels.errorRateLimit
          : res.status === 400 || res.status === 422
            ? labels.errorInvalid
            : labels.errorGeneric;
      setState({ status: "error", message });
    } catch {
      setState({ status: "error", message: labels.errorGeneric });
    }
  }

  const loading = state.status === "loading";

  return (
    <section
      aria-labelledby={titleId}
      className={clsx(
        variant === "card" && "rounded-3xl border border-border bg-surface p-6 sm:p-8",
        className,
      )}
    >
      <h2 id={titleId} className="font-serif text-2xl font-semibold tracking-[-0.01em] text-fg-strong text-balance">
        {labels.title}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-fg-muted text-pretty">{labels.text}</p>

      {state.status === "success" ? (
        <div
          role="status"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-bg-elevated px-4 py-3.5 motion-safe:animate-[fade-up_500ms_var(--ease-out-expo)]"
        >
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
          </span>
          <p className="text-[0.9375rem] text-fg">
            <strong className="font-semibold text-fg-strong">{labels.successTitle}</strong>{" "}
            {state.doubleOptIn ? labels.successConfirm : labels.success}
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-5">
          {/* Stacked on mobile (each control full-width, fixed height), inline from `sm` up. The input must not
              use `flex-1` in the column layout: its 0 basis would collapse the height to a sliver. */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
            <label htmlFor={emailId} className="sr-only">
              {labels.emailLabel}
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder={labels.placeholder}
              aria-invalid={state.status === "error" || undefined}
              aria-describedby={statusId}
              disabled={loading}
              className={clsx(
                // 16px text on mobile prevents iOS Safari from zooming into the focused field.
                "h-12 w-full min-w-0 shrink-0 rounded-full border bg-bg px-4.5 text-base text-fg-strong placeholder:text-fg-subtle",
                "sm:h-11 sm:w-auto sm:flex-1 sm:text-[0.9375rem]",
                "transition-[border-color,box-shadow] duration-300 ease-apple outline-none",
                "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--selection)] focus-visible:outline-none",
                state.status === "error" ? "border-(--tc-red)" : "border-border-strong",
              )}
            />
            {/* Honeypot: hidden from people and assistive tech; bots tend to fill every field. */}
            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>
                Company
                <input name="company" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={clsx(
                "group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-5.5 text-base font-medium text-accent-fg",
                "sm:h-11 sm:text-[0.9375rem]",
                "transition-[background-color,transform] duration-300 ease-apple hover:bg-accent-hover active:scale-[0.98]",
                "disabled:cursor-progress disabled:opacity-80",
              )}
            >
              {loading ? (
                <>
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                  {labels.submitting}
                </>
              ) : (
                <>
                  {labels.submit}
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform duration-300 ease-apple group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </div>
          <p
            id={statusId}
            role={state.status === "error" ? "alert" : undefined}
            aria-live="polite"
            className={clsx("mt-2.5 min-h-5 text-sm", state.status === "error" ? "text-(--tc-red)" : "text-fg-subtle")}
          >
            {state.status === "error" ? state.message : labels.privacy}
          </p>
        </form>
      )}
    </section>
  );
}
