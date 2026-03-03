"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type PlatformCopy = { caption?: string; hashtags?: string };

export function SocialPrepareForm() {
  const [contentType, setContentType] = useState<"blog" | "product">("blog");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, PlatformCopy> | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    try {
      const payload: { contentType: string; title: string; description: string; link?: string } = {
        contentType,
        title: title.trim(),
        description: description.trim(),
      };
      const base = typeof window !== "undefined" ? window.location.origin : "";
      if (slug.trim()) {
        const res = await fetch(`/api/admin/social-lookup?type=${contentType}&slug=${encodeURIComponent(slug.trim())}`);
        const data = await res.json();
        if (data.title) payload.title = data.title;
        if (data.description) payload.description = data.description;
        payload.link = data.link ? `${base}${data.link}` : undefined;
      }
      const res = await fetch("/api/ai/social-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setResult({ _error: { caption: e instanceof Error ? e.message : "Failed" } });
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }

  const platforms = ["instagram", "twitter", "linkedin", "pinterest", "facebook"];

  return (
    <div className="space-y-6">
      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Content source</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as "blog" | "product")}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            >
              <option value="blog">Blog</option>
              <option value="product">Product</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Slug (optional – fetches title/description)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. best-books-jlpt-n1"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Or paste title"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Description / summary</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Paste summary or leave blank if using slug"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || (!title.trim() && !slug.trim())}
            className="btn-primary"
          >
            {loading ? "Generating…" : "Generate captions & hashtags"}
          </button>
        </div>
      </AdminCard>

      {result && "_error" in result ? (
        <p className="text-red-600 text-sm">{(result as { _error: { caption?: string } })._error.caption}</p>
      ) : result ? (
        <AdminCard>
          <h2 className="font-heading font-bold text-charcoal mb-4">Copy per platform</h2>
          <div className="space-y-4">
            {platforms.map((platform) => {
              const p = result[platform];
              if (!p) return null;
              const caption = p.caption ?? "";
              const hashtags = p.hashtags ?? "";
              const full = caption + (hashtags ? " " + hashtags : "");
              return (
                <div key={platform} className="border border-[var(--divider)] rounded-bento p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-charcoal capitalize">{platform}</span>
                    <button
                      type="button"
                      onClick={() => copyText(full)}
                      className="text-sm text-primary hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-secondary text-sm whitespace-pre-wrap break-words">{full || "—"}</p>
                </div>
              );
            })}
          </div>
        </AdminCard>
      ) : null}
    </div>
  );
}
