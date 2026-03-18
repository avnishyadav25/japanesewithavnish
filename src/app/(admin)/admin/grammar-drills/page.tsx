"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

export default function AdminGrammarDrillsPage() {
  const [lessonId, setLessonId] = useState("");
  const [grammarId, setGrammarId] = useState("");
  const [levelCode, setLevelCode] = useState("N5");
  const [count, setCount] = useState(10);
  const [regenerate, setRegenerate] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/admin/grammar-drills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lessonId.trim() || null,
          grammarId: grammarId.trim() || null,
          count,
          regenerate,
          levelCode,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const error = typeof data.error === "string" ? data.error : "";
      if (!res.ok) throw new Error(error || "Failed");
      setStatus("ok");
      const inserted =
        typeof data.inserted === "number" ? data.inserted : typeof data.inserted === "string" ? Number(data.inserted) : 0;
      setMessage(`Inserted ${String(Number.isFinite(inserted) ? inserted : 0)} drill items.`);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Grammar drills generator"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Grammar drills" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Lesson ID (UUID)</label>
              <input
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                placeholder="e.g. 2f8c... (optional if grammarId provided)"
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Grammar ID (UUID)</label>
              <input
                value={grammarId}
                onChange={(e) => setGrammarId(e.target.value)}
                placeholder="optional if lessonId provided"
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Level</label>
                <select
                  value={levelCode}
                  onChange={(e) => setLevelCode(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white"
                >
                  <option value="N5">N5</option>
                  <option value="N4">N4</option>
                  <option value="N3">N3</option>
                  <option value="N2">N2</option>
                  <option value="N1">N1</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Count</label>
                <input
                  type="number"
                  value={count}
                  min={1}
                  max={50}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={regenerate}
                onChange={(e) => setRegenerate(e.target.checked)}
              />
              Delete existing items for the scope first
            </label>
            <button
              onClick={run}
              disabled={status === "loading" || (!lessonId.trim() && !grammarId.trim())}
              className="px-4 py-2 rounded-bento bg-primary text-white disabled:opacity-50"
            >
              {status === "loading" ? "Generating…" : "Generate drills"}
            </button>
            {message && (
              <div
                className={[
                  "text-sm p-3 rounded-bento border",
                  status === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--divider)] bg-base text-charcoal",
                ].join(" ")}
              >
                {message}
              </div>
            )}
            <p className="text-xs text-secondary">
              Tip: open a lesson page (`/learn/curriculum/lesson/[id]`) and copy the UUID from the URL.
            </p>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="space-y-2">
            <h3 className="font-heading font-semibold text-charcoal">Output format</h3>
            <p className="text-sm text-secondary">
              Each item is a Japanese sentence with a single `__` blank, plus `correct_answers` and `distractors` arrays.
            </p>
            <div className="text-xs font-mono bg-base border border-[var(--divider)] rounded-bento p-3 whitespace-pre-wrap">
              {`{
  "sentence_ja": "わたし__ がくせいです。",
  "correct_answers": ["は"],
  "distractors": ["が", "を", "に", "で"],
  "hint": "Topic particle"
}`}
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

