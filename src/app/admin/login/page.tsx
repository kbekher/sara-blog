import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Вход — Sara's Blog",
  robots: { index: false, follow: false },
};

/**
 * Admin login. Static page (no request data): the proxy redirects already-signed-in visitors to /admin,
 * and the form reads `?next=` on the client.
 */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4 py-16">
      {/* soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl border border-border bg-bg-elevated/80 p-8 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-10">
          <header className="mb-8 text-center">
            <h1 className="font-serif text-[2rem] font-semibold leading-tight tracking-tight text-fg-strong text-balance">
              Sara&apos;s Blog
            </h1>
            <p className="mt-2 text-sm text-fg-muted">Вход в панель управления</p>
          </header>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-fg-subtle">Доступ только для автора блога.</p>
      </div>
    </main>
  );
}
