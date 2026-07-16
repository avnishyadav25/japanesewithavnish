"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_ENTITY_TYPES } from "@/lib/contentReview/types";

type Agent = {
  agent_key: string;
  name: string;
  description: string | null;
  scope: string[];
  model_name: string;
  temperature: number;
  is_deterministic: boolean;
  is_enabled: boolean;
  prompt_key: string;
};

export function AgentRow({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(agent.is_enabled);
  const [modelName, setModelName] = useState(agent.model_name);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [scope, setScope] = useState<string[]>(agent.scope);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function save(overrides: Partial<{ isEnabled: boolean }> = {}) {
    setBusy(true);
    try {
      await fetch(`/api/admin/review/agents/${agent.agent_key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: enabled, modelName, temperature, scope, ...overrides }),
      });
      setDirty(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleScope(t: string) {
    setScope((prev) => (prev.includes(t) ? prev.filter((s) => s !== t) : [...prev, t]));
    setDirty(true);
  }

  return (
    <tr className="border-b border-[var(--divider)] align-top">
      <td className="py-3 px-2">
        <p className="font-medium text-charcoal text-sm">{agent.name}</p>
        <p className="text-xs text-secondary">{agent.agent_key}</p>
        {agent.description && <p className="text-xs text-secondary mt-1 max-w-xs">{agent.description}</p>}
      </td>
      <td className="py-3 px-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              save({ isEnabled: e.target.checked });
            }}
            disabled={busy}
          />
          <span className="text-xs text-secondary">{enabled ? "Enabled" : "Disabled"}</span>
        </label>
      </td>
      <td className="py-3 px-2">
        {agent.is_deterministic ? (
          <span className="text-xs text-secondary">deterministic (no model)</span>
        ) : (
          <input
            type="text"
            value={modelName}
            onChange={(e) => {
              setModelName(e.target.value);
              setDirty(true);
            }}
            className="w-32 px-2 py-1 border border-[var(--divider)] rounded-bento text-xs"
          />
        )}
      </td>
      <td className="py-3 px-2">
        {agent.is_deterministic ? (
          "—"
        ) : (
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => {
              setTemperature(Number(e.target.value));
              setDirty(true);
            }}
            className="w-16 px-2 py-1 border border-[var(--divider)] rounded-bento text-xs"
          />
        )}
      </td>
      <td className="py-3 px-2">
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {REVIEW_ENTITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleScope(t)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition ${
                scope.length === 0 || scope.includes(t)
                  ? "bg-primary text-white border-primary"
                  : "bg-base border-[var(--divider)] text-secondary"
              }`}
              title={scope.length === 0 ? "Empty scope = all types" : undefined}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-secondary mt-1">{scope.length === 0 ? "all types" : scope.join(", ")}</p>
      </td>
      <td className="py-3 px-2">
        <a href="/admin/prompts" className="text-primary text-xs hover:underline block">
          Edit prompt →
        </a>
        <a href={`/admin/review/agents/${agent.agent_key}/history`} className="text-primary text-xs hover:underline block mt-1">
          Version history →
        </a>
      </td>
      <td className="py-3 px-2">
        {dirty && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save()}
            className="px-2.5 py-1 rounded-bento text-xs font-medium bg-primary text-white hover:opacity-90 transition disabled:opacity-50"
          >
            Save
          </button>
        )}
      </td>
    </tr>
  );
}
