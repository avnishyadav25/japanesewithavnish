"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LearnEditPageActions({
  contentType,
  slug,
  status,
  redirectAfterDelete,
}: {
  contentType: string;
  slug: string;
  status: string;
  /** After delete, go here (e.g. "/admin/blogs" when editing from unified blog edit). */
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/learning-content/${contentType}/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete");
        return;
      }
      router.push(redirectAfterDelete ?? `/admin/learn/${contentType}`);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/admin/learn/${contentType}/${slug}/preview`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary"
      >
        Preview
      </Link>
      {status === "published" && (
        <Link
          href={`/blog/${contentType}/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          View
        </Link>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="px-4 py-2 rounded-bento border border-red-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
