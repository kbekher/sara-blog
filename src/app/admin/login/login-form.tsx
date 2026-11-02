"use client";
import { useActionState, useEffect, useRef } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  // `next` is read from the URL at submit time so the page itself stays fully static (no searchParams).
  const [state, formAction, pending] = useActionState(async (prev: LoginState, formData: FormData) => {
    formData.set("next", new URLSearchParams(window.location.search).get("next") ?? "");
    return login(prev, formData);
  }, initialState);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  }, [state]);

  const errorId = "login-error";

  return (
    <form action={formAction} className="flex flex-col gap-5" aria-describedby={state.error ? errorId : undefined}>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-fg-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          defaultValue={state.email ?? ""}
          key={state.email ?? "email"}
          aria-invalid={state.error ? true : undefined}
          className="h-11 rounded-xl border border-border bg-bg-sunken px-3.5 text-[0.9375rem] text-fg-strong outline-none transition-[border-color,box-shadow] duration-200 ease-apple placeholder:text-fg-subtle focus:border-accent focus:ring-4 focus:ring-accent/15"
          placeholder="sara@example.com"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium text-fg-muted">
          Пароль
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
          className="h-11 rounded-xl border border-border bg-bg-sunken px-3.5 text-[0.9375rem] text-fg-strong outline-none transition-[border-color,box-shadow] duration-200 ease-apple focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </div>

      <p
        id={errorId}
        role="alert"
        aria-live="polite"
        className={
          state.error
            ? "rounded-xl border border-[color:var(--tc-red)]/30 bg-[color:var(--hl-red)] px-3.5 py-2.5 text-sm text-fg-strong"
            : "sr-only"
        }
      >
        {state.error ?? ""}
      </p>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[0.9375rem] font-semibold text-accent-fg transition-[background-color,opacity,transform] duration-200 ease-apple hover:bg-accent-hover active:scale-[0.99] disabled:cursor-progress disabled:opacity-70"
      >
        {pending && (
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        )}
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
