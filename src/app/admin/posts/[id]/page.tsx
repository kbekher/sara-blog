import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { getPost } from "../../actions";
import { PostEditor } from "@/components/editor/post-editor";

export const metadata: Metadata = { title: "Редактор" };
// Reads the session & uncached post data on every request.
export const instant = false;
// Publishing awaits Brevo (create campaign + sendNow); the platform default is too short for long posts.
export const maxDuration = 60;

export default function EditPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

async function EditorLoader({ params }: { params: PageProps<"/admin/posts/[id]">["params"] }) {
  const { id } = await params;
  await connection(); // request-time only (see admin/page.tsx)
  const res = await getPost(id);
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-16 text-center">
        <AlertCircle className="mx-auto size-8 text-[var(--tc-red)]" aria-hidden />
        <h1 className="mt-4 font-serif text-2xl text-fg-strong">Не удалось открыть запись</h1>
        <p className="mt-2 text-sm text-fg-muted">{res.error}</p>
        <Link href="/admin" className="admin-btn admin-btn-secondary mt-6">
          <ArrowLeft className="size-4" aria-hidden />
          Ко всем записям
        </Link>
      </main>
    );
  }
  // key: a different post (or a fresh load) gets a fresh editor state.
  return <PostEditor key={res.data.id} initial={res.data} />;
}

function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Загрузка редактора">
      <div className="h-14 border-b border-border" />
      <div className="mx-auto max-w-[44rem] space-y-5 px-5 pt-12">
        <div className="admin-skeleton aspect-[2/1] w-full rounded-2xl" />
        <div className="admin-skeleton h-10 w-4/5" />
        <div className="admin-skeleton h-6 w-3/5" />
        <div className="space-y-3 pt-6">
          <div className="admin-skeleton h-5 w-full" />
          <div className="admin-skeleton h-5 w-11/12" />
          <div className="admin-skeleton h-5 w-4/5" />
        </div>
      </div>
    </div>
  );
}
