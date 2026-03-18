import { Suspense } from "react";
import { NewBlogPageClient } from "./NewBlogPageClient";

export default function AdminBlogsNewPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <NewBlogPageClient />
    </Suspense>
  );
}
