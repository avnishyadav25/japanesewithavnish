"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";

type Props = {
  submoduleId: string;
  levelCode: string;
  moduleTitle: string;
  initial: { code: string; title: string; sort_order: number; summary: string; description: string; feature_image_url: string };
};

export function SubmoduleEditFormClient({ submoduleId, levelCode, moduleTitle, initial }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initial.code);
  const [title, setTitle] = useState(initial.title);
  const [sort_order, setSortOrder] = useState(initial.sort_order);
  const [summary, setSummary] = useState(initial.summary);
  const [description, setDescription] = useState(initial.description);
  const [feature_image_url, setFeatureImageUrl] = useState(initial.feature_image_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/curriculum/submodules/${submoduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, title, sort_order, summary: summary || null, description: description || null, feature_image_url: feature_image_url.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function suggestWithAI() {
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/curriculum/suggest-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "submodule", code, title, levelCode, moduleTitle }),
      });
      const data = await res.json();
      if (res.ok && (data.summary != null || data.description != null)) {
        if (typeof data.summary === "string") setSummary(data.summary);
        if (typeof data.description === "string") setDescription(data.description);
      } else if (!res.ok) setError(data.error || "AI failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">Code</label>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">Sort order</label>
        <input type="number" value={sort_order} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-24 px-3 py-2 border border-[var(--divider)] rounded-bento" />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-charcoal">Summary</label>
          <button type="button" disabled={aiLoading} onClick={suggestWithAI} className="text-primary text-sm font-medium hover:underline disabled:opacity-60">
            {aiLoading ? "Suggesting…" : "Suggest with AI"}
          </button>
        </div>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento" placeholder="Short blurb" />
      </div>
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento" placeholder="Longer overview" />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-charcoal">Feature image URL</label>
          <button type="button" onClick={() => setImageModalOpen(true)} className="text-primary text-sm font-medium hover:underline">
            Generate with AI
          </button>
        </div>
        <input type="url" value={feature_image_url} onChange={(e) => setFeatureImageUrl(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento" placeholder="https://… (heading + japanesewithavnish.com at bottom)" />
        {feature_image_url.trim() && (
          <div className="mt-2">
            <p className="text-xs text-secondary mb-1">Preview</p>
            <img src={feature_image_url.trim()} alt="Feature preview" className="rounded-bento border border-[var(--divider)] max-h-40 max-w-xs object-cover bg-[var(--divider)]/20" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}
      </div>
      <GenerateImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        imageType="curriculum"
        initialContext={{ title: title, topic: title, entityType: "submodule" }}
        initialPrompt=""
        onGenerated={(url) => { setFeatureImageUrl(url); setImageModalOpen(false); }}
      />
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
