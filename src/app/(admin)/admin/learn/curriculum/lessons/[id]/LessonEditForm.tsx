"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";

type Props = {
  lessonId: string;
  levelCode?: string;
  initial: {
    code: string;
    title: string;
    goal: string;
    introduction: string;
    description: string;
    access_type: string;
    content_type: string;
    estimated_minutes: number;
    sort_order: number;
    feature_image_url: string;
  };
};

export function LessonEditForm({ lessonId, levelCode = "N5", initial }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initial.code);
  const [title, setTitle] = useState(initial.title);
  const [goal, setGoal] = useState(initial.goal);
  const [introduction, setIntroduction] = useState(initial.introduction);
  const [description, setDescription] = useState(initial.description);
  const [access_type, setAccessType] = useState(initial.access_type);
  const [content_type, setContentType] = useState(initial.content_type);
  const [estimated_minutes, setEstimatedMinutes] = useState(initial.estimated_minutes);
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
        body: JSON.stringify({
          code,
          title,
          goal: goal || null,
          introduction: introduction || null,
          description: description || null,
          access_type,
          content_type: content_type || null,
          estimated_minutes: estimated_minutes || null,
          sort_order,
          feature_image_url: feature_image_url.trim() || null,
        }),
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
    <form onSubmit={handleSubmit} className="w-full space-y-4 bg-white p-6 rounded-bento border border-[var(--divider)] shadow-xs">
      <h3 className="font-heading font-semibold text-charcoal text-base">Lesson Properties</h3>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Code</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Access Type</label>
          <select value={access_type} onChange={(e) => setAccessType(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white">
            <option value="premium">Premium 🔒</option>
            <option value="free">Free 🆓</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Content Type</label>
          <select value={content_type} onChange={(e) => setContentType(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white">
            <option value="">-- Select type --</option>
            <option value="grammar">Grammar 📖</option>
            <option value="vocabulary">Vocabulary 📝</option>
            <option value="kanji">Kanji 漢</option>
            <option value="reading">Reading 📰</option>
            <option value="listening">Listening 👂</option>
            <option value="mock_test">Mock Test 📋</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Est. Minutes</label>
          <input type="number" value={estimated_minutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">Goal / Objective</label>
        <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" placeholder="e.g. Learn あいうえお to なにぬねの with stroke order" />
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">Short Description (for student path view)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" placeholder="Brief 1-2 sentence description shown on the lesson timeline page." />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-charcoal">Introduction Draft (Student page header)</label>
          <select value={contentLLM} onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")} className="text-xs border rounded px-2 py-0.5 bg-white">
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
            className="text-primary text-xs font-semibold hover:underline disabled:opacity-60"
          >
            {introLoading ? "Generating…" : "Generate intro with AI"}
          </button>
        </div>
        <textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows={3} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">Sort order</label>
          <input type="number" value={sort_order} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-24 px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="block text-sm font-medium text-charcoal">Feature image URL</label>
            <button type="button" onClick={() => setImageModalOpen(true)} className="text-primary text-xs font-semibold hover:underline">
              Generate with AI
            </button>
          </div>
          <input type="url" value={feature_image_url} onChange={(e) => setFeatureImageUrl(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" placeholder="https://…" />
        </div>
      </div>

      {feature_image_url.trim() && (
        <div className="mt-2 border-t border-[var(--divider)] pt-4">
          <p className="text-xs text-secondary mb-1">Feature Image Preview</p>
          <img src={feature_image_url.trim()} alt="Feature preview" className="rounded-bento border border-[var(--divider)] max-h-40 max-w-xs object-cover bg-[var(--divider)]/20" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      <GenerateImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        imageType="curriculum"
        initialContext={{ title: title, topic: title, entityType: "lesson" }}
        initialPrompt=""
        onGenerated={(url) => { setFeatureImageUrl(url); setImageModalOpen(false); }}
      />
      <div className="pt-2">
        <button type="submit" disabled={saving} className="btn-primary w-full md:w-auto px-6 py-2 text-sm">
          {saving ? "Saving…" : "Save Properties"}
        </button>
      </div>
    </form>
  );
}
