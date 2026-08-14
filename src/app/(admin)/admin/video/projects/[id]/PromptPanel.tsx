"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { formatDuration } from "@/lib/video/pacing";

interface Slot {
  id: string;
  hint: string;
  maxWords: number;
  seconds?: number;
}

interface Preview {
  systemPrompt: string;
  userMessage: string;
  slots: Slot[];
  promptKey: string;
  model: string;
  estimate: {
    itemCount: number;
    sceneCount: number;
    seconds: number;
    readable: string;
    ttsCostUsd: number;
    approxPromptTokens: number;
  };
  contentWarnings: string[];
}

export interface GenerateOverrides {
  systemPrompt?: string;
  slotOverrides?: Record<string, { hint?: string; maxWords?: number }>;
}

/**
 * Shows exactly what will be sent to the model, and lets it be changed for this run.
 *
 * "Generate script" used to be a black box that cost a call and produced whatever it produced.
 * The preview is built by the same `buildGenerationRequest` the real generation uses, so what
 * you read here cannot drift from what actually runs — and every run is recorded verbatim in
 * `video_generation_runs`, so a version that came out well can be reproduced.
 *
 * Edits apply to this generation only. They do not touch the saved prompt at /admin/prompts.
 */
export function PromptPanel({
  projectId,
  narrationLang,
  disabled,
  onGenerate,
}: {
  projectId: string;
  narrationLang: string;
  disabled: boolean;
  onGenerate: (overrides: GenerateOverrides) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [slotEdits, setSlotEdits] = useState<Record<string, { hint?: string; maxWords?: number }>>({});
  const [showSlots, setShowSlots] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/video/projects/${projectId}/generate/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrationLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build the request");
      setPreview(data);
      setSystemPrompt(data.systemPrompt);
      setSlotEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the request");
    } finally {
      setLoading(false);
    }
  }, [projectId, narrationLang]);

  useEffect(() => {
    if (open && !preview) void load();
  }, [open, preview, load]);

  const dirty =
    Boolean(preview && systemPrompt !== preview.systemPrompt) || Object.keys(slotEdits).length > 0;

  return (
    <AdminCard>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading font-bold text-charcoal">Generate script</h3>
          <p className="text-sm text-secondary">
            {preview
              ? `${preview.estimate.itemCount} items · ${preview.estimate.sceneCount} scenes · about ${preview.estimate.readable}`
              : "Reads the source content out of the database and writes narration for it."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-sm px-3 py-2 rounded-button border border-[var(--divider)] text-secondary hover:border-primary"
          >
            {open ? "Hide the prompt" : "Show the prompt"}
          </button>
          <button
            type="button"
            onClick={() =>
              onGenerate({
                systemPrompt: preview && systemPrompt !== preview.systemPrompt ? systemPrompt : undefined,
                slotOverrides: Object.keys(slotEdits).length > 0 ? slotEdits : undefined,
              })
            }
            disabled={disabled}
            className="btn-primary disabled:opacity-50"
          >
            {dirty ? "Generate with my edits" : "Generate script"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-5 pt-5 border-t border-[var(--divider)] space-y-5">
          {loading && <p className="text-sm text-secondary">Building the request…</p>}
          {error && <p className="text-sm text-primary">{error}</p>}

          {preview && (
            <>
              <div className="grid sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Model" value={preview.model} />
                <Stat label="Prompt" value={`~${preview.estimate.approxPromptTokens} tokens`} />
                <Stat label="Estimated length" value={formatDuration(preview.estimate.seconds)} />
                <Stat
                  label="Voiceover cost"
                  value={preview.estimate.ttsCostUsd < 0.01 ? "under a cent" : `~$${preview.estimate.ttsCostUsd.toFixed(3)}`}
                />
              </div>

              {preview.contentWarnings.length > 0 && (
                <ul className="space-y-1.5 border-l-4 border-amber-400 pl-3">
                  {preview.contentWarnings.map((w, i) => (
                    <li key={i} className="text-sm text-secondary">{w}</li>
                  ))}
                </ul>
              )}

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="text-sm font-semibold text-charcoal" htmlFor="sysprompt">
                    System prompt
                    <span className="font-normal text-secondary"> · from {preview.promptKey}</span>
                  </label>
                  {systemPrompt !== preview.systemPrompt && (
                    <button
                      type="button"
                      onClick={() => setSystemPrompt(preview.systemPrompt)}
                      className="text-xs text-primary hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <textarea
                  id="sysprompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={14}
                  className="w-full text-xs font-mono border border-[var(--divider)] rounded-button px-3 py-2 focus:outline-none focus:border-primary resize-y"
                />
                <p className="text-xs text-secondary mt-1">
                  Edits apply to this generation only. To change it permanently, edit{" "}
                  <code className="bg-base px-1 rounded">{preview.promptKey}</code> at /admin/prompts.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowSlots(!showSlots)}
                  className="text-sm font-semibold text-charcoal hover:text-primary"
                >
                  {showSlots ? "▾" : "▸"} {preview.slots.length} narration slots
                  <span className="font-normal text-secondary"> — word budgets computed from your pacing</span>
                </button>

                {showSlots && (
                  <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {preview.slots.map((slot) => {
                      const edit = slotEdits[slot.id] ?? {};
                      return (
                        <div key={slot.id} className="border border-[var(--divider)] rounded-button p-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <code className="text-[11px] text-subtle">{slot.id}</code>
                            <label className="flex items-center gap-1.5 text-xs text-secondary">
                              max
                              <input
                                type="number"
                                min={4}
                                max={200}
                                value={edit.maxWords ?? slot.maxWords}
                                onChange={(e) =>
                                  setSlotEdits((s) => ({ ...s, [slot.id]: { ...s[slot.id], maxWords: Number(e.target.value) } }))
                                }
                                className="w-16 border border-[var(--divider)] rounded px-1.5 py-0.5 text-xs"
                              />
                              words
                              {slot.seconds ? <span className="text-subtle">≈{slot.seconds.toFixed(1)}s</span> : null}
                            </label>
                          </div>
                          <textarea
                            value={edit.hint ?? slot.hint}
                            onChange={(e) => setSlotEdits((s) => ({ ...s, [slot.id]: { ...s[slot.id], hint: e.target.value } }))}
                            rows={2}
                            className="w-full text-xs border border-[var(--divider)] rounded px-2 py-1.5 focus:outline-none focus:border-primary resize-y"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <details>
                <summary className="text-sm font-semibold text-charcoal cursor-pointer hover:text-primary">
                  Full user message as it will be sent
                </summary>
                <pre className="mt-2 text-[11px] font-mono bg-base rounded-button p-3 overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {preview.userMessage}
                </pre>
              </details>

              <button type="button" onClick={() => void load()} className="text-xs text-primary hover:underline">
                Rebuild from current settings
              </button>
            </>
          )}
        </div>
      )}
    </AdminCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-secondary">{label}</div>
      <div className="text-charcoal font-medium">{value}</div>
    </div>
  );
}
