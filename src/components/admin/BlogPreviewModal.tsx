"use client";

import ReactMarkdown from "react-markdown";

type BlogPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  publishedAt?: string;
  ogImageUrl?: string;
};

export function BlogPreviewModal({
  open,
  onClose,
  title,
  content,
  publishedAt,
  ogImageUrl,
}: BlogPreviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-bento shadow-xl border border-[var(--divider)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--divider)]">
          <span className="text-sm font-medium text-secondary">Preview</span>
          <button
            type="button"
            onClick={onClose}
            className="text-secondary hover:text-charcoal text-sm"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {ogImageUrl && (
            <div className="mb-6 rounded-bento overflow-hidden border border-[var(--divider)]">
              <img
                src={ogImageUrl}
                alt=""
                className="w-full max-h-64 object-cover object-top"
              />
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">
            {title || "Untitled"}
          </h1>
          {publishedAt && (
            <time className="text-secondary text-sm block mb-6">
              {new Date(publishedAt).toLocaleDateString()}
            </time>
          )}
          <div className="prose prose-charcoal max-w-none [&_h2]:font-heading [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2">
            {content ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              <p className="text-secondary italic">No content yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
