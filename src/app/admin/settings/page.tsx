import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { getSiteSettingsAdmin } from "../actions";
import { HeroPortraitSettings } from "@/components/admin/hero-portrait-settings";

export const metadata: Metadata = { title: "Настройки сайта" };
// Reads the session & uncached settings on every request.
export const instant = false;

export default function SiteSettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <h1 className="mb-8 font-serif text-3xl font-semibold text-fg-strong sm:text-4xl">Настройки сайта</h1>
      <Suspense fallback={<SettingsSkeleton />}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  await connection(); // request-time only (see admin/page.tsx)
  const res = await getSiteSettingsAdmin();
  if (!res.ok) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-border-strong p-5 text-sm text-fg-muted">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--tc-red)]" aria-hidden />
        <div>
          <p className="font-medium text-fg">Не удалось загрузить настройки</p>
          <p className="mt-1">{res.error}</p>
        </div>
      </div>
    );
  }
  return <HeroPortraitSettings initial={res.data.heroPortrait} />;
}

function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка настроек" className="rounded-3xl border border-border p-5 sm:p-7">
      <div className="admin-skeleton h-7 w-48" />
      <div className="admin-skeleton mt-3 h-4 w-2/3" />
      <div className="mt-6 flex flex-col gap-6 sm:flex-row">
        <div className="admin-skeleton aspect-[3/4] w-full max-w-[16rem] rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="admin-skeleton h-8 w-64" />
          <div className="admin-skeleton h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
