"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LearnContentRowActions({
  contentType,
  slug,
  status,
}: {
  contentType: string;
  slug: string;
  status: string;
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
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href={`/admin/blogs/${slug}/edit`} className="text-primary text-sm hover:underline">
        Edit
      </Link>
      <Link
        href={`/admin/learn/${contentType}/${slug}/preview`}
        className="text-primary text-sm hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        Preview
      </Link>
      {status === "published" && (
        <Link
          href={`/blog/${contentType}/${slug}`}
          className="text-primary text-sm hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View
        </Link>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-red-600 text-sm hover:underline disabled:opacity-50"
      >
        {deleting ? "…" : "Delete"}
      </button>
    </span>
  );
}
