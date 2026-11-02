import type { Metadata } from "next";
import { PostEditor } from "@/components/editor/post-editor";

export const metadata: Metadata = { title: "Новая запись" };

/** New post: created on the first autosave, then the URL becomes /admin/posts/[id] (without remounting). */
export default function NewPostPage() {
  return <PostEditor initial={null} />;
}
