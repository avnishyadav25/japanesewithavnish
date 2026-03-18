"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getListPrompt, type ContentType, type PromptContext } from "@/lib/ai/prompts";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";

type ListItem = { title?: string; slug?: string; meta?: Record<string, unknown> };

type PostForFilter = { content_type?: string | null; slug: string; title: string };

export function GenerateListModal({
  open,
  onClose,
  posts = [],
}: {
  open: boolean;
  onClose: () => void;
  posts?: PostForFilter[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "form">("type");
  const [contentType, setContentType] = useState<string>("grammar");
  const [jlptLevel, setJlptLevel] = useState("N5");
  const [listCount, setListCount] = useState(20);
  const [topic, setTopic] = useState("");
  const [contentLLM, setContentLLM] = useState<"deepseek" | "gemini">("deepseek");
  const [overrideExisting, setOverrideExisting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ListItem[] | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{ created: number; updated: number; skipped: number; errors?: string[] } | null>(null);

  const existingItems = posts.filter((p) => (p.content_type ?? "") === contentType).map((p) => ({ slug: p.slug, title: p.title }));
  const existingSlugs = existingItems.map((i) => i.slug).filter(Boolean);
  const context: PromptContext = {
    jlptLevel,
    listCount,
    topic: topic || undefined,
    existingSlugs: existingSlugs.length > 0 ? existingSlugs : undefined,
  };
  const previewPrompt = getListPrompt(contentType as ContentType, context);

  useEffect(() => {
    if (!open) {
      setStep("type");
      setResult(null);
      setRaw(null);
      setError(null);
      setSaveResult(null);
      setCustomPrompt("");
    }
  }, [open]);

  const promptToSend = customPrompt.trim() || previewPrompt;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setRaw(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          context: { jlptLevel, listCount, topic: topic || undefined },
          generateList: true,
          content_llm: contentLLM,
          customPrompt: promptToSend,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (Array.isArray(data.list)) setResult(data.list);
      if (data.raw) setRaw(data.raw);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  function copyJson() {
    const text = result?.length ? JSON.stringify(result, null, 2) : raw ?? "";
    if (text && navigator.clipboard) navigator.clipboard.writeText(text);
  }

  async function handleSaveToList() {
    const list = result?.length ? result : null;
    if (!list?.length) return;
    setSaving(true);
    setError(null);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/admin/learning-content/${contentType}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: list.map((it) => ({
            title: it.title ?? it.slug ?? "",
            slug: it.slug ?? "",
            meta: it.meta ?? {},
            jlpt_level: jlptLevel || null,
          })),
          override: overrideExisting,
          jlpt_level: jlptLevel || null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setSaveResult({
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        skipped: data.skipped ?? 0,
        errors: data.errors,
      });
      router.refresh();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl bg-white rounded-bento shadow-xl border border-[var(--divider)] max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-charcoal text-lg">Generate AI list</h2>

          {step === "type" && (
            <>
              <p className="text-sm text-secondary">Choose content type</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LEARN_CONTENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setContentType(t);
                      setStep("form");
                    }}
                    className="px-4 py-3 rounded-bento border border-[var(--divider)] text-left hover:border-primary hover:bg-primary/5 transition"
                  >
                    {LEARN_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              </div>
            </>
          )}

          {step === "form" && (
            <>
              <button
                type="button"
                onClick={() => setStep("type")}
                className="text-sm text-secondary hover:text-primary"
              >
                ← Change type
              </button>
              <p className="text-sm text-secondary">
                Generating: <span className="font-medium text-charcoal">{LEARN_TYPE_LABELS[contentType as LearnContentType]}</span>
              </p>
              {existingSlugs.length > 0 && (
                <p className="text-xs text-secondary">
                  {existingSlugs.length} existing item{existingSlugs.length !== 1 ? "s" : ""} — prompt will ask AI not to duplicate these slugs.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">JLPT level</label>
                  <select
                    value={jlptLevel}
                    onChange={(e) => setJlptLevel(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal bg-white"
                  >
                    {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Count</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={listCount}
                    onChange={(e) => setListCount(Math.max(1, parseInt(e.target.value, 10) || 20))}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Model</label>
                  <select
                    value={contentLLM}
                    onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal bg-white"
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Topic / scope (optional)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. N5 verbs, time expressions"
                  className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-charcoal">Prompt (preview & edit)</label>
                  {customPrompt.trim() && (
                    <button type="button" onClick={() => setCustomPrompt("")} className="text-xs text-secondary hover:text-charcoal">Reset to default</button>
                  )}
                </div>
                <textarea
                  value={customPrompt || previewPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm font-mono"
                  placeholder={previewPrompt}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              {(result !== null || raw !== null) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-charcoal">Result</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={copyJson} className="text-sm text-primary hover:underline">Copy JSON</button>
                      {result?.length != null && result.length > 0 && (
                        <button type="button" onClick={handleSaveToList} disabled={saving} className="text-sm btn-primary py-1 px-3">
                          {saving ? "Saving…" : "Save to list"}
                        </button>
                      )}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 mt-2 mb-1 text-sm text-charcoal">
                    <input type="checkbox" checked={overrideExisting} onChange={(e) => setOverrideExisting(e.target.checked)} className="rounded border-[var(--divider)]" />
                    Override existing (update entries with same slug)
                  </label>
                  <textarea
                    readOnly
                    rows={10}
                    value={result?.length ? JSON.stringify(result, null, 2) : raw ?? ""}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-xs"
                  />
                  {result?.length != null && result.length > 0 && <p className="text-xs text-secondary mt-1">{result.length} items generated.</p>}
                  {saveResult && (
                    <p className="text-sm text-charcoal mt-2">
                      Saved: {saveResult.created} created, {saveResult.updated} updated, {saveResult.skipped} skipped.
                      {saveResult.errors?.length ? ` Errors: ${saveResult.errors.join("; ")}` : ""}
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleGenerate} disabled={loading} className="btn-primary flex-1">
                  {loading ? "Generating…" : "Generate list"}
                </button>
                <button type="button" onClick={onClose} className="btn-secondary">Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
