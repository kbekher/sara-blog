"use client";
/** Admin top bar: brand, link to the public site, theme toggle and logout. Hidden on the login page. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { logout } from "@/app/admin/actions";
import { defaultLocale } from "@/lib/i18n/config";
import { site } from "@/lib/site";
import { ThemeToggle } from "./theme-toggle";

export function AdminTopBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/login")) return null;
  // The post editor has its own sticky header; keep the global bar compact there.
  return (
    <div
      className="border-b border-border"
      style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/admin" className="mr-auto truncate text-sm text-fg-muted transition-colors hover:text-fg">
          <span className="font-serif text-base font-semibold text-fg-strong">{site.name[defaultLocale]}</span>
          <span className="mx-1.5 text-fg-subtle">·</span>
          Админка
        </Link>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="admin-btn admin-btn-ghost admin-btn-sm"
          aria-label="Открыть сайт в новой вкладке"
        >
          <span className="hidden sm:inline">Сайт</span>
          <ExternalLink className="size-4" aria-hidden />
        </a>
        <ThemeToggle />
        <form action={logout}>
          <button type="submit" className="admin-btn admin-btn-ghost admin-btn-sm" aria-label="Выйти из админки">
            <span className="hidden sm:inline">Выйти</span>
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
