import type { Metadata } from "next";
import { PostEditor } from "@/components/editor/post-editor";

export const metadata: Metadata = { title: "Новая запись" };
// Publishing awaits Brevo (create campaign + sendNow); the platform default is too short for long posts.
export const maxDuration = 60;

/** New post: created on the first autosave, then the URL becomes /admin/posts/[id] (without remounting). */
export default function NewPostPage() {
  return <PostEditor initial={null} />;
}
