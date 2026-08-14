"use client";

import { useEffect, useState } from "react";

type ModuleStat = { moduleId: string; moduleTitle: string; total: number; correctCount: number; accuracyRate: number };

export function AnalyticsClient() {
  const [data, setData] = useState<{
    accuracyRate: number | null;
    averageResponseTimeMs: number | null;
    totalResponses: number;
    byModule: ModuleStat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learn/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-secondary text-sm">Loading…</p>;
  if (!data) return <p className="text-secondary text-sm">Could not load analytics.</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <h3 className="text-sm font-medium text-secondary">Total responses (30d)</h3>
          <p className="text-2xl font-bold text-charcoal">{data.totalResponses}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-secondary">Accuracy</h3>
          <p className="text-2xl font-bold text-charcoal">
            {data.accuracyRate != null ? `${data.accuracyRate}%` : "—"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-secondary">Avg. response time</h3>
          <p className="text-2xl font-bold text-charcoal">
            {data.averageResponseTimeMs != null ? `${data.averageResponseTimeMs} ms` : "—"}
          </p>
        </div>
      </div>
      {data.byModule.length > 0 && (
        <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
          <h2 className="font-heading font-semibold text-charcoal mb-3">By module (drill accuracy)</h2>
          <p className="text-secondary text-sm mb-3">Modules with more practice; lower accuracy may need review.</p>
          <ul className="space-y-2">
            {data.byModule.map((m) => (
              <li key={m.moduleId} className="flex justify-between items-center text-sm">
                <span className="text-charcoal">{m.moduleTitle}</span>
                <span className={m.accuracyRate < 70 ? "text-primary font-medium" : "text-charcoal"}>
                  {m.accuracyRate}% ({m.correctCount}/{m.total})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
