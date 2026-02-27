"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  author_name: string;
  author_email: string;
  content: string;
  status: string;
  created_at: string;
};

type CommentsManagerProps = {
  comments: Comment[];
};

export function CommentsManager({ comments }: CommentsManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [previewCommentId, setPreviewCommentId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handleRemove(id: string) {
    if (!confirm("Remove this comment? It will no longer be visible on the blog.")) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/comments/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert("Failed to remove comment.");
    } finally {
      setLoading(null);
    }
  }

  async function handlePreviewGuidelines(id: string) {
    setPreviewLoading(true);
    setPreviewCommentId(id);
    setPreviewHtml(null);
    try {
      const res = await fetch(`/api/admin/comments/${id}?preview=guidelines`);
      const html = await res.text();
      if (res.ok) setPreviewHtml(html);
      else alert("Failed to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSendGuidelines(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_guidelines" }),
      });
      if (res.ok) {
        setPreviewCommentId(null);
        setPreviewHtml(null);
        alert("Email sent.");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send email.");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
    <div className="divide-y divide-[var(--divider)]">
      {comments.map((c) => (
        <div
          key={c.id}
          className={`py-4 px-2 ${c.status === "removed" ? "opacity-60" : ""}`}
        >
          <div className="flex flex-wrap items-baseline gap-2 mb-2">
            <span className="font-medium text-charcoal">{c.author_name}</span>
            <span className="text-secondary text-sm">{c.author_email}</span>
            <time className="text-secondary text-xs">
              {new Date(c.created_at).toLocaleString()}
            </time>
            {c.status === "removed" && (
              <span className="text-xs text-red-600 font-medium">Removed</span>
            )}
          </div>
          <p className="text-charcoal text-sm mb-3 whitespace-pre-wrap">{c.content}</p>
          {c.status === "approved" && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                disabled={loading !== null}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {loading === c.id ? "Removing…" : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGuidelines(c.id)}
                disabled={loading !== null || previewLoading}
                className="text-sm text-secondary hover:text-primary hover:underline disabled:opacity-50"
              >
                {previewLoading && previewCommentId === c.id ? "Loading…" : "Preview email"}
              </button>
              <button
                type="button"
                onClick={() => handleSendGuidelines(c.id)}
                disabled={loading !== null}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {loading === c.id ? "Sending…" : "Send guidelines email"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>

    {previewHtml !== null && previewCommentId && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
        onClick={() => {
          setPreviewCommentId(null);
          setPreviewHtml(null);
        }}
        aria-hidden
      >
        <div
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-bento shadow-xl border border-[var(--divider)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--divider)] shrink-0">
            <span className="text-sm font-medium text-charcoal">Email preview</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSendGuidelines(previewCommentId)}
                disabled={loading !== null}
                className="btn-primary text-sm py-2 px-4 disabled:opacity-60"
              >
                {loading === previewCommentId ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewCommentId(null);
                  setPreviewHtml(null);
                }}
                className="text-secondary hover:text-charcoal text-sm"
              >
                Close
              </button>
            </div>
          </div>
          <iframe
            srcDoc={previewHtml}
            title="Email preview"
            className="flex-1 w-full min-h-[400px] border-0"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    )}
    </>
  );
}
