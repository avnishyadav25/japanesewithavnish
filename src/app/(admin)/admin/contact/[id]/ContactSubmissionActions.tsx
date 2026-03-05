"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContactSubmissionActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "read" | "replied") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contact-submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      {status !== "read" && status !== "replied" && (
        <button
          type="button"
          onClick={() => updateStatus("read")}
          disabled={loading}
          className="px-3 py-1.5 rounded-bento text-sm font-medium border border-[var(--divider)] text-charcoal hover:bg-base disabled:opacity-50"
        >
          {loading ? "…" : "Mark read"}
        </button>
      )}
      {status !== "replied" && (
        <button
          type="button"
          onClick={() => updateStatus("replied")}
          disabled={loading}
          className="px-3 py-1.5 rounded-bento text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "…" : "Mark replied"}
        </button>
      )}
    </div>
  );
}
