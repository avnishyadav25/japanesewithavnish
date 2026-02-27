"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

const TEMPLATES = [
  {
    id: "magic-link",
    name: "Magic Link",
    description: "Sent when a user requests login access to their library.",
    trigger: "User clicks 'Login' and enters email",
  },
  {
    id: "welcome-newsletter",
    name: "Welcome Newsletter",
    description: "Sent when someone subscribes to the newsletter (footer or first comment).",
    trigger: "New subscriber signup",
  },
  {
    id: "order-confirmation",
    name: "Order Confirmation",
    description: "Sent after a successful purchase with library access link.",
    trigger: "Payment completed",
  },
  {
    id: "quiz-results",
    name: "Quiz Results",
    description: "Sent with JLPT level recommendation and bundle link after quiz completion.",
    trigger: "User completes placement quiz",
  },
  {
    id: "new-comment",
    name: "New Comment Notification",
    description: "Sent to previous commenters when someone adds a new comment on a blog post.",
    trigger: "New comment posted",
  },
  {
    id: "community-guidelines",
    name: "Community Guidelines",
    description: "Sent by admin when a commenter needs a reminder about community guidelines.",
    trigger: "Admin clicks 'Send guidelines email'",
  },
];

export default function AdminEmailTemplatesPage() {
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePreview(id: string) {
    setLoading(true);
    setPreviewType(id);
    setPreviewHtml(null);
    try {
      const res = await fetch(`/api/admin/email-templates/preview?type=${id}`);
      const html = await res.text();
      if (res.ok) setPreviewHtml(html);
      else setPreviewHtml("<p>Failed to load preview.</p>");
    } catch {
      setPreviewHtml("<p>Failed to load preview.</p>");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Email templates"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <p className="text-secondary text-sm mb-6 max-w-2xl">
        All transactional and notification emails use these templates. Each includes the product list at the bottom (except Magic Link).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <AdminCard key={t.id} className="flex flex-col">
            <h3 className="font-heading font-semibold text-charcoal mb-1">{t.name}</h3>
            <p className="text-secondary text-sm mb-2 flex-1">{t.description}</p>
            <p className="text-xs text-secondary mb-3">
              <strong>Trigger:</strong> {t.trigger}
            </p>
            <button
              type="button"
              onClick={() => handlePreview(t.id)}
              disabled={loading}
              className="btn-primary text-sm py-2 px-4 w-fit disabled:opacity-60"
            >
              {loading && previewType === t.id ? "Loading…" : "Preview"}
            </button>
          </AdminCard>
        ))}
      </div>

      {previewHtml !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          onClick={() => {
            setPreviewType(null);
            setPreviewHtml(null);
          }}
          aria-hidden
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-bento shadow-xl border border-[var(--divider)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--divider)] shrink-0">
              <span className="text-sm font-medium text-charcoal">
                {TEMPLATES.find((x) => x.id === previewType)?.name} — Preview
              </span>
              <button
                type="button"
                onClick={() => {
                  setPreviewType(null);
                  setPreviewHtml(null);
                }}
                className="text-secondary hover:text-charcoal text-sm"
              >
                Close
              </button>
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
    </div>
  );
}
