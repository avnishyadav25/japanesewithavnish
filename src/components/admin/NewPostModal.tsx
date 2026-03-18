"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";

const BLOG_PREFILL_KEY = "blog_new_prefill";
const LEARN_PREFILL_KEY = "learn_new_prefill";

const CONTENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "blog", label: "Blog" },
  ...LEARN_CONTENT_TYPES.map((t) => ({ value: t, label: LEARN_TYPE_LABELS[t] })),
];

type Step = "type" | "mode";

export function NewPostModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("type");
  const [contentType, setContentType] = useState<string>("blog");
  const [mode, setMode] = useState<"manual" | "ai" | "generate">("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blog AI fields
  const [blogTitle, setBlogTitle] = useState("");
  const [blogLevel, setBlogLevel] = useState("N5");
  const [blogTags, setBlogTags] = useState("");
  const [blogDescription, setBlogDescription] = useState("");

  // Learn generate fields
  const [listCount, setListCount] = useState(1);
  const [jlptLevel, setJlptLevel] = useState("N5");
  const [topic, setTopic] = useState("");

  const isBlog = contentType === "blog";
  const isLearn = contentType !== "blog" && LEARN_CONTENT_TYPES.includes(contentType as LearnContentType);

  function resetAndClose() {
    setStep("type");
    setContentType("blog");
    setMode("manual");
    setError(null);
    setBlogTitle("");
    setBlogTags("");
    setBlogDescription("");
    setListCount(1);
    setTopic("");
    onClose();
  }

  function goManual() {
    if (isBlog) {
      resetAndClose();
      router.push("/admin/blogs/new");
      return;
    }
    if (isLearn) {
      resetAndClose();
      router.push(`/admin/blogs/new?content_type=${encodeURIComponent(contentType)}`);
      return;
    }
    resetAndClose();
  }

  async function goBlogAI() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "blog",
          context: {
            title: blogTitle || undefined,
            jlptLevel: blogLevel,
            tags: blogTags || undefined,
            description: blogDescription || undefined,
          },
          generateList: false,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const prefill = {
        title: data.title ?? "",
        slug: data.slug ?? "",
        content: data.content ?? "",
        summary: (data.seo_description ?? "").slice(0, 300),
        jlpt_level: Array.isArray(data.jlpt_level) ? data.jlpt_level : data.jlpt_level ? [data.jlpt_level] : null,
        tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : null,
        status: "draft",
        published_at: null,
        seo_title: data.seo_title ?? "",
        seo_description: data.seo_description ?? "",
        og_image_url: null,
        image_prompt: data.image_prompt ?? null,
      };
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(BLOG_PREFILL_KEY, JSON.stringify(prefill));
      }
      resetAndClose();
      router.push("/admin/blogs/new");
    } catch {
      setError("Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function goLearnGenerateOne() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          context: { jlptLevel, listCount: 1, topic: topic || undefined },
          generateList: true,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const list = Array.isArray(data.list) ? data.list : [];
      const item = list[0];
      if (item && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(
          LEARN_PREFILL_KEY,
          JSON.stringify({
            contentType,
            item: {
              title: item.title ?? item.slug ?? "",
              slug: item.slug ?? "",
              meta: item.meta ?? {},
              jlpt_level: jlptLevel || null,
            },
          })
        );
      }
      resetAndClose();
      router.push(`/admin/blogs/new?content_type=${encodeURIComponent(contentType)}`);
    } catch {
      setError("Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function goLearnGenerateMany() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          context: { jlptLevel, listCount, topic: topic || undefined },
          generateList: true,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const list = Array.isArray(data.list) ? data.list : [];
      if (list.length === 0) {
        setError("No items generated");
        setLoading(false);
        return;
      }
      const bulkRes = await fetch(`/api/admin/learning-content/${contentType}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: list.map((it: { title?: string; slug?: string; meta?: Record<string, unknown> }) => ({
            title: it.title ?? it.slug ?? "",
            slug: it.slug ?? "",
            meta: it.meta ?? {},
            jlpt_level: jlptLevel || null,
          })),
          override: false,
          jlpt_level: jlptLevel || null,
        }),
      });
      const bulkData = await bulkRes.json();
      if (bulkData.error) {
        setError(bulkData.error);
        setLoading(false);
        return;
      }
      resetAndClose();
      router.refresh();
      window.location.reload();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={resetAndClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-bento shadow-xl border border-[var(--divider)] max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-charcoal text-lg">New post</h2>

          {step === "type" && (
            <>
              <p className="text-sm text-secondary">Choose content type</p>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setContentType(opt.value);
                      setStep("mode");
                    }}
                    className="px-4 py-3 rounded-bento border border-[var(--divider)] text-left hover:border-primary hover:bg-primary/5 transition"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "mode" && (
            <>
              <button
                type="button"
                onClick={() => setStep("type")}
                className="text-sm text-secondary hover:text-primary"
              >
                ← Back
              </button>
              <p className="text-sm text-secondary">
                Create as: <span className="font-medium text-charcoal">{contentType === "blog" ? "Blog" : LEARN_TYPE_LABELS[contentType as LearnContentType]}</span>
              </p>

              {isBlog && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={goManual}
                    className="w-full px-4 py-3 rounded-bento border border-[var(--divider)] hover:border-primary hover:bg-primary/5 transition text-left"
                  >
                    Manual — create from scratch
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("ai")}
                    className="w-full px-4 py-3 rounded-bento border border-[var(--divider)] hover:border-primary hover:bg-primary/5 transition text-left"
                  >
                    AI — generate draft from title/tags
                  </button>
                  {mode === "ai" && (
                    <div className="pt-2 space-y-2 border-t border-[var(--divider)]">
                      <input
                        type="text"
                        placeholder="Title (optional)"
                        value={blogTitle}
                        onChange={(e) => setBlogTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
                      />
                      <select
                        value={blogLevel}
                        onChange={(e) => setBlogLevel(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
                      >
                        {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Tags (optional)"
                        value={blogTags}
                        onChange={(e) => setBlogTags(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
                      />
                      <textarea
                        placeholder="Description (optional)"
                        value={blogDescription}
                        onChange={(e) => setBlogDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
                      />
                      <button
                        type="button"
                        onClick={goBlogAI}
                        disabled={loading}
                        className="btn-primary w-full py-2"
                      >
                        {loading ? "Generating…" : "Generate and open create"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isLearn && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={goManual}
                    className="w-full px-4 py-3 rounded-bento border border-[var(--divider)] hover:border-primary hover:bg-primary/5 transition text-left"
                  >
                    Manual — create from scratch
                  </button>
                  <div className="border-t border-[var(--divider)] pt-3">
                    <p className="text-sm text-secondary mb-2">Generate list (AI)</p>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <label className="text-xs">Count</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={listCount}
                        onChange={(e) => setListCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-16 px-2 py-1 border border-[var(--divider)] rounded text-sm"
                      />
                      <label className="text-xs">JLPT</label>
                      <select
                        value={jlptLevel}
                        onChange={(e) => setJlptLevel(e.target.value)}
                        className="px-2 py-1 border border-[var(--divider)] rounded text-sm"
                      >
                        {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Topic (optional)"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="flex-1 min-w-[100px] px-2 py-1 border border-[var(--divider)] rounded text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      {listCount === 1 ? (
                        <button
                          type="button"
                          onClick={goLearnGenerateOne}
                          disabled={loading}
                          className="btn-primary py-2 flex-1"
                        >
                          {loading ? "Generating…" : "Generate 1 and open create"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={goLearnGenerateMany}
                          disabled={loading}
                          className="btn-primary py-2 flex-1"
                        >
                          {loading ? "Generating…" : `Generate ${listCount} and save to list`}
                        </button>
                      )}
                    </div>
                    {listCount > 1 && (
                      <p className="text-xs text-secondary mt-1">Creates {listCount} items and stays on list.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end pt-2">
            <button type="button" onClick={resetAndClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { BLOG_PREFILL_KEY, LEARN_PREFILL_KEY };
