"use client";

import { useState, useEffect, useCallback } from "react";

type MainContent = {
  content: string | null;
  content_slug: string | null;
  post_id: string | null;
  title: string | null;
  jlpt_level?: string[] | null;
  tags?: string[] | null;
  status?: string;
};

export function LessonBodySection({
  lessonId,
  lessonTitle = "",
  levelCode = "N5",
}: {
  lessonId: string;
  lessonTitle?: string;
  levelCode?: string;
}) {
  const [main, setMain] = useState<MainContent | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [contentLLM, setContentLLM] = useState<"deepseek" | "gemini">("deepseek");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/main-content`);
      const data = await res.json().catch(() => ({}));
      setMain(data as MainContent);
      setBody(typeof data.content === "string" ? data.content : "");
    } catch {
      setError("Failed to load lesson body");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!main?.content_slug || main.content_slug.trim() === "") {
      setError("No main content slug to save");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/learning-content/study_guide/${encodeURIComponent(main.content_slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: main.content_slug,
          title: main.title || lessonTitle + " (Main)",
          content: body,
          jlpt_level: main.jlpt_level?.[0] ?? levelCode,
          tags: main.tags ?? [levelCode, "lesson", "curriculum"],
          status: main.status ?? "published",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || "Save failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(regenerate: boolean) {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/ai/curriculum/generate-lesson-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, content_llm: contentLLM, regenerate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Generate failed");
      const content = (data as { content?: string }).content;
      if (typeof content === "string") setBody(content);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full">
        <p className="text-secondary text-sm">Loading lesson body…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Lesson body (main content)</h3>
        <p className="text-secondary text-sm mb-2">
          This is the teaching content shown in the &quot;Lesson&quot; section on the student page. For kana lessons, it should explain each character and sound; for grammar/vocab, explain the pattern with examples.
          <br />
          <span className="text-secondary text-xs">
            Note: Generate with AI creates the main body only if it&apos;s missing. Use Regenerate with AI to overwrite existing text.
          </span>
        </p>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <select
            value={contentLLM}
            onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")}
            className="text-sm border border-[var(--divider)] rounded-bento px-2 py-1"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Gemini</option>
          </select>
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className="px-3 py-2 rounded-bento bg-primary text-white text-sm font-medium disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate with AI"}
          </button>
          {main?.content_slug && (
            <>
              <button
                type="button"
                onClick={() => handleGenerate(true)}
                disabled={generating}
                className="px-3 py-2 rounded-bento border border-[var(--divider)] text-charcoal text-sm disabled:opacity-60"
              >
                Regenerate with AI
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-2 rounded-bento border border-[var(--divider)] text-charcoal text-sm disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Lesson body (Markdown). Use “Generate with AI” to create teaching content (only if missing) for the 15 characters and sounds, or edit manually."
          rows={18}
          className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento font-mono text-sm"
        />
        {main?.content_slug && (
          <p className="text-secondary text-xs mt-1">Slug: {main.content_slug}</p>
        )}
      </section>
    </div>
  );
}
