import { NotFoundContent } from "@/components/site/not-found-content";

/** Rendered inside the site layout when a page calls `notFound()` (unknown post, tag, page number, …). */
export default function NotFound() {
  return <NotFoundContent />;
}
