"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";

type Newsletter = {
  id: string;
  slug: string;
  title: string | null;
  subject: string;
  body_html: string;
  status: string;
  sent_at: string | null;
};

export function NewsletterForm({ newsletter }: { newsletter?: Newsletter | null }) {
  const router = useRouter();
  const isEdit = Boolean(newsletter?.id);
  const [slug, setSlug] = useState(newsletter?.slug ?? "");
  const [title, setTitle] = useState(newsletter?.title ?? "");
  const [subject, setSubject] = useState(newsletter?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(newsletter?.body_html ?? "");
  const [status, setStatus] = useState(newsletter?.status ?? "draft");
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const [sendStatus, setSendStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  useEffect(() => {
    if (newsletter) {
      setSlug(newsletter.slug);
      setTitle(newsletter.title ?? "");
      setSubject(newsletter.subject);
      setBodyHtml(newsletter.body_html);
      setStatus(newsletter.status);
    }
  }, [newsletter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("loading");
    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/newsletters/${newsletter!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, title: title || null, subject, body_html: bodyHtml, status }),
        });
        if (!res.ok) throw new Error("Failed");
        setSaveStatus("saved");
      } else {
        const res = await fetch("/api/admin/newsletters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, title: title || null, subject, body_html: bodyHtml, status }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        router.push(`/admin/newsletters/${data.id}/edit`);
        return;
      }
    } catch {
      setSaveStatus("error");
    }
  }

  async function handleSend() {
    if (!isEdit || newsletter?.status === "sent") return;
    setSendStatus("loading");
    try {
      const res = await fetch(`/api/admin/newsletters/${newsletter!.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSendStatus("sent");
      router.refresh();
    } catch {
      setSendStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AdminCard>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="newsletter-1"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-charcoal">Body (HTML)</label>
              {!isEdit && (
                <GenerateContentButton
                  contentType="newsletter"
                  context={{ topic: title || subject, description: "" }}
                  onGenerated={(data) => {
                    if (typeof data === "string") setBodyHtml(data);
                    else if (typeof (data as { content?: string }).content === "string")
                      setBodyHtml((data as { content: string }).content);
                  }}
                />
              )}
            </div>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={14}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
            />
          </div>
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
              </select>
            </div>
          )}
        </div>
      </AdminCard>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn-primary" disabled={saveStatus === "loading"}>
          {saveStatus === "loading" ? "Saving…" : "Save"}
        </button>
        {saveStatus === "saved" && <span className="text-emerald-600 text-sm">Saved.</span>}
        {saveStatus === "error" && <span className="text-red-600 text-sm">Save failed.</span>}
        {isEdit && newsletter && newsletter.status !== "sent" && (
          <>
            <a
              href={`/api/admin/newsletters/${newsletter.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:text-primary text-sm"
            >
              Preview
            </a>
            <button
              type="button"
              onClick={handleSend}
              disabled={sendStatus === "loading"}
              className="bg-green-600 text-white px-4 py-2 rounded-bento text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {sendStatus === "loading" ? "Sending…" : "Send to subscribers"}
            </button>
            {sendStatus === "sent" && <span className="text-emerald-600 text-sm">Sent.</span>}
            {sendStatus === "error" && <span className="text-red-600 text-sm">Send failed.</span>}
          </>
        )}
        <Link href="/admin/newsletters" className="text-secondary hover:text-primary text-sm">
          Back to list
        </Link>
      </div>
    </form>
  );
}
