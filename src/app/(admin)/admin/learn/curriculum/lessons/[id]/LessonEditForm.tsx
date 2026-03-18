"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";

type Props = {
  lessonId: string;
  levelCode?: string;
  initial: { code: string; title: string; goal: string; introduction: string; sort_order: number; feature_image_url: string };
};

export function LessonEditForm({ lessonId, levelCode = "N5", initial }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initial.code);
  const [title, setTitle] = useState(initial.title);
  const [goal, setGoal] = useState(initial.goal);
  const [introduction, setIntroduction] = useState(initial.introduction);
  const [sort_order, setSortOrder] = useState(initial.sort_order);
  const [feature_image_url, setFeatureImageUrl] = useState(initial.feature_image_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [introLoading, setIntroLoading] = useState(false);
  const [contentLLM, setContentLLM] = useState<"deepseek" | "gemini">("deepseek");
  const [imageModalOpen, setImageModalOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, title, goal: goal || null, introduction: introduction || null, sort_order, feature_image_url: feature_image_url.trim() || null }),
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
        <label className="block text-sm font-medium text-charcoal mb-1">Goal</label>
        <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento" />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-charcoal">Introduction</label>
          <select value={contentLLM} onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")} className="text-sm border rounded px-2 py-1">
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Gemini</option>
          </select>
          <button
            type="button"
            disabled={introLoading}
            onClick={async () => {
              setIntroLoading(true);
              try {
                const res = await fetch("/api/ai/curriculum/generate-lesson-intro", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lessonTitle: title, goal: goal || undefined, levelCode, content_llm: contentLLM }),
                });
                const data = await res.json();
                if (data.introduction !== undefined) setIntroduction(data.introduction);
                if (data.goal !== undefined) setGoal(data.goal);
              } finally {
                setIntroLoading(false);
              }
            }}
            className="text-primary text-sm font-medium hover:underline disabled:opacity-60"
          >
            {introLoading ? "Generating…" : "Generate with AI"}
          </button>
        </div>
        <textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows={4} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento" />
      </div>
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">Sort order</label>
        <input type="number" value={sort_order} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-24 px-3 py-2 border border-[var(--divider)] rounded-bento" />
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
        initialContext={{ title: title, topic: title, entityType: "lesson" }}
        initialPrompt=""
        onGenerated={(url) => { setFeatureImageUrl(url); setImageModalOpen(false); }}
      />
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
