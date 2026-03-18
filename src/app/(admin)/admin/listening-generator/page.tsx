"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

export default function AdminListeningGeneratorPage() {
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
      const error = typeof data.error === "string" ? data.error : "";
      if (!res.ok) throw new Error(error || "Failed");
      setStatus("ok");

      const insertedScenarios =
        typeof data.insertedScenarios === "number"
          ? data.insertedScenarios
          : typeof data.insertedScenarios === "string"
            ? Number(data.insertedScenarios)
            : 0;
      const insertedQuestions =
        typeof data.insertedQuestions === "number"
          ? data.insertedQuestions
          : typeof data.insertedQuestions === "string"
            ? Number(data.insertedQuestions)
            : 0;
      const audioUrl = typeof data.audioUrl === "string" ? data.audioUrl : "";
      setMessage(
        `Inserted ${String(Number.isFinite(insertedScenarios) ? insertedScenarios : 0)} scenarios and ${String(
          Number.isFinite(insertedQuestions) ? insertedQuestions : 0
        )} questions. audioUrl=${audioUrl}`
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Listening scenarios generator"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Listening generator" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminCard>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Listening ID (UUID)</label>
              <input
                value={listeningId}
                onChange={(e) => setListeningId(e.target.value)}
                placeholder="optional if listeningSlug provided"
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Listening post slug</label>
              <input
                value={listeningSlug}
                onChange={(e) => setListeningSlug(e.target.value)}
                placeholder="e.g. n5-listening-greetings-..."
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                <label className="block text-sm font-medium text-charcoal mb-1">Scenarios</label>
                <input
                  type="number"
                  value={scenarioCount}
                  min={1}
                  max={20}
                  onChange={(e) => setScenarioCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Questions</label>
                <input
                  type="number"
                  value={questionsPerScenario}
                  min={1}
                  max={5}
                  onChange={(e) => setQuestionsPerScenario(Number(e.target.value))}
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
              Delete existing scenarios/questions for this listening first
            </label>
            <button
              onClick={run}
              disabled={status === "loading" || (!listeningId.trim() && !listeningSlug.trim())}
              className="px-4 py-2 rounded-bento bg-primary text-white disabled:opacity-50"
            >
              {status === "loading" ? "Generating…" : "Generate listening scenarios"}
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
              MVP audio uses `\u0060/api/audio/silence\u0060` so the player always has a valid URL.
            </p>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="space-y-2">
            <h3 className="font-heading font-semibold text-charcoal">Where this shows up</h3>
            <p className="text-sm text-secondary">
              Student listening page lists scenarios from `\u0060listening_scenarios\u0060` and loads questions from `\u0060listening_questions\u0060`.
            </p>
            <div className="text-xs text-secondary">
              - List: <span className="font-mono">GET /api/learn/listening/scenarios</span>
              <br />
              - Detail: <span className="font-mono">GET /api/learn/listening/scenarios/[id]</span>
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

