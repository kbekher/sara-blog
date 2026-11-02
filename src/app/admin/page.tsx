import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, AlertCircle } from "lucide-react";
import { listPosts } from "./actions";
import { PostList } from "@/components/admin/post-list";

export const metadata: Metadata = { title: "Записи" };
// Reads the session & uncached data on every request.
export const instant = false;

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-4xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-fg-strong sm:text-4xl">Записи</h1>
        <Link href="/admin/posts/new" className="admin-btn admin-btn-primary">
          <Plus className="size-4" aria-hidden />
          Новая запись
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <Posts />
      </Suspense>
    </main>
  );
}

async function Posts() {
  // Request-time only: keeps admin data out of build/runtime prerenders and prefetches.
  await connection();
  const res = await listPosts();
  if (!res.ok) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-border-strong p-5 text-sm text-fg-muted">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--tc-red)]" aria-hidden />
        <div>
          <p className="font-medium text-fg">Не удалось загрузить записи</p>
          <p className="mt-1">{res.error}</p>
        </div>
      </div>
    );
  }
  return <PostList posts={res.data} />;
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка записей" className="space-y-6">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="admin-skeleton h-8 w-24 rounded-full" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border pb-4">
          <div className="admin-skeleton hidden aspect-[4/3] w-24 rounded-xl sm:block" />
          <div className="flex-1 space-y-2">
            <div className="admin-skeleton h-5 w-3/4" />
            <div className="admin-skeleton h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
