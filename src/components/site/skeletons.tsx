import clsx from "clsx";

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("rounded-xl bg-surface motion-safe:animate-pulse", className)} />;
}

export function PostGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-border">
          <Bone className="aspect-[3/2] rounded-none" />
          <div className="space-y-3 p-6">
            <Bone className="h-6 w-4/5" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div aria-hidden className="article-measure px-5 pt-14 sm:px-8">
      <Bone className="h-4 w-24" />
      <Bone className="mt-8 h-12 w-full" />
      <Bone className="mt-3 h-12 w-3/4" />
      <Bone className="mt-6 h-6 w-2/3" />
      <Bone className="mt-10 aspect-[3/2] w-full rounded-3xl" />
      <div className="mt-10 space-y-3">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 rounded-2xl border border-border p-5">
          <Bone className="h-5 w-2/3" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-hidden className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
      <Bone className="h-4 w-28" />
      <Bone className="mt-4 h-12 w-2/3 max-w-xl" />
      <Bone className="mt-4 h-5 w-1/2 max-w-md" />
      <div className="mt-14">
        <PostGridSkeleton />
      </div>
    </div>
  );
}
