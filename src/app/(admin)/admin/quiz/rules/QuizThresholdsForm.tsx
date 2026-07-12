"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type Threshold = { level: string; min_score: number; recommended_product_id: string | null };
type Product = { id: string; name: string };

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export function QuizThresholdsForm({ initial, products }: { initial: Threshold[]; products: Product[] }) {
  const [rows, setRows] = useState<Record<string, { min_score: string; recommended_product_id: string }>>(() => {
    const map: Record<string, { min_score: string; recommended_product_id: string }> = {};
    for (const level of LEVELS) {
      const existing = initial.find((t) => t.level === level);
      map[level] = {
        min_score: existing ? String(existing.min_score) : "",
        recommended_product_id: existing?.recommended_product_id ?? "",
      };
    }
    return map;
  });
  const [savingLevel, setSavingLevel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function saveLevel(level: string) {
    setSavingLevel(level);
    setMsg("");
    try {
      const res = await fetch("/api/admin/quiz/thresholds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          min_score: Number(rows[level].min_score),
          recommended_product_id: rows[level].recommended_product_id || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMsg(`✅ Saved ${level}`);
    } catch {
      setMsg(`❌ Failed to save ${level}`);
    } finally {
      setSavingLevel(null);
    }
  }

  return (
    <AdminCard>
      {msg && <p className="text-xs font-semibold text-charcoal mb-4">{msg}</p>}
      <div className="space-y-4">
        {LEVELS.map((level) => (
          <div key={level} className="grid grid-cols-[80px_1fr_1fr_auto] items-end gap-3 pb-4 border-b border-[var(--divider)] last:border-0 last:pb-0">
            <div>
              <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Level</label>
              <span className="inline-block px-2 py-1.5 text-xs font-bold text-charcoal">{level}</span>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Min Score</label>
              <input
                type="number"
                min="0"
                value={rows[level].min_score}
                onChange={(e) => setRows((r) => ({ ...r, [level]: { ...r[level], min_score: e.target.value } }))}
                className="w-full h-9 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Recommended Product</label>
              <select
                value={rows[level].recommended_product_id}
                onChange={(e) => setRows((r) => ({ ...r, [level]: { ...r[level], recommended_product_id: e.target.value } }))}
                className="w-full h-9 px-2 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
              >
                <option value="">None</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => saveLevel(level)}
              disabled={savingLevel === level || !rows[level].min_score}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-[#D0021B] hover:bg-[#D0021B]/95 text-white transition disabled:opacity-50"
            >
              {savingLevel === level ? "Saving..." : "Save"}
            </button>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
