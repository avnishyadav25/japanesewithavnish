"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type LessonOption = {
  id: string;
  title: string;
  level_code: string;
  module_title: string;
};

export function ContentGeneratorClient({ lessons }: { lessons: LessonOption[] }) {
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [provider, setProvider] = useState("deepseek");
  const [regenerate, setRegenerate] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");

  async function run() {
    setStatus("loading");
    setMessage("");
    setPreview("");
    try {
      const res = await fetch("/api/ai/curriculum/generate-lesson-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, content_llm: provider, regenerate }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Lesson generation failed");
      setStatus("ok");
      setMessage(regenerate ? "Generated and saved lesson body." : "Loaded existing lesson body or generated content if missing.");
      setPreview(typeof data.content === "string" ? data.content : "");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Lesson generation failed");
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
      <AdminCard>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Lesson</label>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white">
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.level_code} - {lesson.module_title} - {lesson.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white">
                <option value="deepseek">DeepSeek</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-charcoal mt-6">
              <input type="checkbox" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} />
              Regenerate and save over existing content
            </label>
          </div>

          <div className="rounded-bento border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This API directly saves generated content when regeneration is enabled. Review the Markdown preview after generation.
          </div>

          <button onClick={run} disabled={status === "loading" || !lessonId} className="btn-primary disabled:opacity-50">
            {status === "loading" ? "Working..." : regenerate ? "Regenerate Lesson Body" : "Load / Generate Lesson Body"}
          </button>

          {message ? (
            <div className={`text-sm p-3 rounded-bento border ${status === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {message}
            </div>
          ) : null}
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading text-lg font-semibold text-charcoal mb-3">Markdown Preview</h2>
        {preview ? (
          <pre className="whitespace-pre-wrap text-xs leading-6 bg-base border border-[var(--divider)] rounded-bento p-4 max-h-[640px] overflow-auto">{preview}</pre>
        ) : (
          <p className="text-sm text-secondary">Generated or existing lesson body content will appear here.</p>
        )}
      </AdminCard>
    </div>
  );
}
