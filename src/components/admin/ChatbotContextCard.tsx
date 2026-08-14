"use client";

import { useState, useCallback } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

function lineDiff(current: string, preview: string): { removed: string[]; added: string[] } {
  const curLines = current.split("\n");
  const preLines = preview.split("\n");
  const curSet = new Set(curLines);
  const preSet = new Set(preLines);
  const removed = curLines.filter((l) => !preSet.has(l));
  const added = preLines.filter((l) => !curSet.has(l));
  return { removed, added };
}

export function ChatbotContextCard() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [currentContent, setCurrentContent] = useState<string | null>(null);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentOpen, setCurrentOpen] = useState(false);

  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [diffOpen, setDiffOpen] = useState(false);

  const loadCurrent = useCallback(async () => {
    setCurrentLoading(true);
    try {
      const res = await fetch("/api/admin/chatbot-context", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setCurrentContent(data.content ?? null);
        setCurrentUpdatedAt(data.updatedAt ?? null);
      }
    } finally {
      setCurrentLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewContent(null);
    try {
      const res = await fetch("/api/admin/chatbot-context/preview", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setPreviewContent(data.content ?? "");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleUpdate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/chatbot-context/pull", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Updated. Context length: ${data.length ?? 0} chars.`);
        setCurrentContent(null);
        setCurrentUpdatedAt(null);
        setPreviewContent(null);
        loadCurrent();
      } else {
        setMessage(data.error || "Failed");
      }
    } catch {
      setMessage("Failed");
    } finally {
      setLoading(false);
    }
  };

  const currentLen = currentContent?.length ?? 0;
  const previewLen = previewContent?.length ?? 0;
  const diff = currentContent != null && previewContent != null ? lineDiff(currentContent, previewContent) : null;

  return (
    <AdminCard>
      <h2 className="font-heading font-bold text-charcoal mb-4">Chatbot (japani-bhai) & Nihongo Navi</h2>
      <p className="text-secondary text-sm mb-4">
        Context includes <strong>blogs, products, and published learning content</strong>. Rebuilding updates both the site chat (japani-bhai) and Nihongo Navi (/tutor). Pull to refresh.
      </p>

      {/* Current context */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadCurrent}
            disabled={currentLoading}
            className="text-sm border border-[var(--divider)] rounded-bento px-3 py-1.5 hover:bg-[var(--base)] disabled:opacity-50"
          >
            {currentLoading ? "Loading…" : "Load current context"}
          </button>
          {currentContent != null && (
            <>
              <span className="text-sm text-secondary">
                {currentLen} chars
                {currentUpdatedAt && ` · Updated ${new Date(currentUpdatedAt).toLocaleString()}`}
              </span>
              <button
                type="button"
                onClick={() => setCurrentOpen((o) => !o)}
                className="text-sm text-primary"
              >
                {currentOpen ? "Hide" : "Show"} content
              </button>
            </>
          )}
        </div>
        {currentContent != null && currentOpen && (
          <pre className="mt-2 p-3 bg-[var(--base)] border border-[var(--divider)] rounded-bento text-xs overflow-auto max-h-64 whitespace-pre-wrap">
            {currentContent || "(empty)"}
          </pre>
        )}
      </div>

      {/* Preview (what will be saved) */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadPreview}
            disabled={previewLoading}
            className="text-sm border border-[var(--divider)] rounded-bento px-3 py-1.5 hover:bg-[var(--base)] disabled:opacity-50"
          >
            {previewLoading ? "Building…" : "Preview update"}
          </button>
          {previewContent != null && (
            <>
              <span className="text-sm text-secondary">{previewLen} chars</span>
              <button
                type="button"
                onClick={() => setPreviewOpen((o) => !o)}
                className="text-sm text-primary"
              >
                {previewOpen ? "Hide" : "Show"} preview
              </button>
            </>
          )}
        </div>
        {previewContent != null && previewOpen && (
          <pre className="mt-2 p-3 bg-[var(--base)] border border-[var(--divider)] rounded-bento text-xs overflow-auto max-h-64 whitespace-pre-wrap">
            {previewContent}
          </pre>
        )}
      </div>

      {/* Diff (when both loaded) */}
      {diff != null && (diff.removed.length > 0 || diff.added.length > 0) && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setDiffOpen((o) => !o)}
            className="text-sm text-primary"
          >
            {diffOpen ? "Hide" : "Show"} diff ({diff.removed.length} removed, {diff.added.length} added)
          </button>
          {diffOpen && (
            <div className="mt-2 grid sm:grid-cols-2 gap-3 text-xs">
              <div className="border border-red-200 rounded-bento p-2 bg-red-50/50 max-h-48 overflow-auto">
                <p className="font-medium text-red-700 mb-1">Removed from current</p>
                {diff.removed.length === 0 ? (
                  <p className="text-secondary">—</p>
                ) : (
                  diff.removed.slice(0, 50).map((line, i) => (
                    <div key={i} className="text-red-800 whitespace-pre-wrap break-words">− {line}</div>
                  ))
                )}
                {diff.removed.length > 50 && <p className="text-secondary mt-1">… and {diff.removed.length - 50} more</p>}
              </div>
              <div className="border border-green-200 rounded-bento p-2 bg-green-50/50 max-h-48 overflow-auto">
                <p className="font-medium text-green-700 mb-1">Added in preview</p>
                {diff.added.length === 0 ? (
                  <p className="text-secondary">—</p>
                ) : (
                  diff.added.slice(0, 50).map((line, i) => (
                    <div key={i} className="text-green-800 whitespace-pre-wrap break-words">+ {line}</div>
                  ))
                )}
                {diff.added.length > 50 && <p className="text-secondary mt-1">… and {diff.added.length - 50} more</p>}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleUpdate}
        className="btn-primary"
      >
        {loading ? "Updating…" : "Update chatbot context"}
      </button>
      {message && <p className="mt-2 text-sm text-secondary">{message}</p>}
    </AdminCard>
  );
}
