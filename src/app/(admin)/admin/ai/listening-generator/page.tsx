"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

export default function AdminAIListeningGeneratorPage() {
  const [listeningId, setListeningId] = useState("");
  const [listeningSlug, setListeningSlug] = useState("");
  const [levelCode, setLevelCode] = useState("N5");
  const [scenarioCount, setScenarioCount] = useState(3);
  const [questionsPerScenario, setQuestionsPerScenario] = useState(3);
  const [regenerate, setRegenerate] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/admin/listening/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listeningId: listeningId.trim() || null,
          listeningSlug: listeningSlug.trim() || null,
          levelCode,
          scenarioCount,
          questionsPerScenario,
          regenerate,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Listening generation failed");
      const insertedScenarios = Number(data.insertedScenarios ?? 0);
      const insertedQuestions = Number(data.insertedQuestions ?? 0);
      setStatus("ok");
      setMessage(`Inserted ${insertedScenarios} scenario(s) and ${insertedQuestions} question(s). ${data.audioUrl ? `Audio URL: ${String(data.audioUrl)}` : ""}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Listening generation failed");
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="AI Listening Generator"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "AI Tools" }, { label: "Listening" }]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <AdminCard>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Listening ID</label>
                <input value={listeningId} onChange={(e) => setListeningId(e.target.value)} placeholder="UUID, optional if slug is provided" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Listening slug</label>
                <input value={listeningSlug} onChange={(e) => setListeningSlug(e.target.value)} placeholder="n5-listening-greetings" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">JLPT level</label>
                <select value={levelCode} onChange={(e) => setLevelCode(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white">
                  {["N5", "N4", "N3", "N2", "N1"].map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Scenarios</label>
                <input type="number" min={1} max={20} value={scenarioCount} onChange={(e) => setScenarioCount(Number(e.target.value))} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Questions per scenario</label>
                <input type="number" min={1} max={5} value={questionsPerScenario} onChange={(e) => setQuestionsPerScenario(Number(e.target.value))} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} />
              Regenerate by deleting existing scenarios/questions first
            </label>

            <button onClick={run} disabled={status === "loading" || (!listeningId.trim() && !listeningSlug.trim())} className="btn-primary disabled:opacity-50">
              {status === "loading" ? "Generating..." : "Generate Listening Practice"}
            </button>

            {message ? (
              <div className={`text-sm p-3 rounded-bento border ${status === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {message}
              </div>
            ) : null}
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="font-heading text-lg font-semibold text-charcoal mb-3">Requirements</h2>
          <div className="space-y-2 text-sm text-secondary">
            <p>Provide either a listening content ID or slug. The API resolves the listening item, generates scenario scripts and comprehension questions, then inserts them into the listening tables.</p>
            <p>Missing DeepSeek/Gemini keys are returned as clear API errors and shown here.</p>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
