import { PageSkeleton } from "@/components/site/skeletons";

/** Segment-level fallback for client navigations while a page's data streams in. */
export default function Loading() {
  return <PageSkeleton />;
}
