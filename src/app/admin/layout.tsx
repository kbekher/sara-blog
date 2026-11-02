import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { sourceSerif } from "../fonts";
import { ThemeScript } from "@/components/theme-script";
import { ToastProvider } from "@/components/admin/toast";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { site } from "@/lib/site";
// globals.css also pulls in src/styles/prose.css (`.prose-sara`), which the editor body uses for true WYSIWYG.
import "../globals.css";
import "@/components/admin/admin.css";

export const metadata: Metadata = {
  title: { default: `Админка · ${site.name}`, template: "%s · Админка" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
  ],
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="ru" className={sourceSerif.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <ToastProvider>
          <Suspense fallback={<div className="h-12 border-b border-border" />}>
            <AdminTopBar />
          </Suspense>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
