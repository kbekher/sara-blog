import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { sourceSerif } from "../fonts";
import { ThemeScript } from "@/components/theme-script";
import { ToastProvider } from "@/components/admin/toast";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import "../globals.css";
// Public article typography (owned by the public-site agent) — the editor body uses `.prose-sara` for true WYSIWYG.
import "@/styles/prose.css";
import "@/components/admin/admin.css";

export const metadata: Metadata = {
  title: { default: "Админка · Sara's Blog", template: "%s · Админка" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
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
