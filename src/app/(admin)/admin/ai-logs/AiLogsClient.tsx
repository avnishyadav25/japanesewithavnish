"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Log = {
  id: string;
  log_type: string;
  content_type: string;
  entity_type: string | null;
  entity_id: string | null;
  model_used: string;
  prompt_sent: string | null;
  result_preview: string | null;
  created_at: string;
  admin_email: string | null;
};

export function AiLogsClient() {
  const searchParams = useSearchParams();
  const entityType = searchParams?.get("entityType") ?? "";
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = entityType ? `/api/admin/ai-logs?entityType=${encodeURIComponent(entityType)}` : "/api/admin/ai-logs";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs ?? []);
      })
      .finally(() => setLoading(false));
  }, [entityType]);

  if (loading) return <div className="card py-8 text-center text-secondary">Loading…</div>;
  if (logs.length === 0) return <div className="card py-8 text-center text-secondary">No log entries yet.</div>;

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--divider)]">
          <tr>
            <th className="py-3 px-3 text-left font-medium text-charcoal">Time</th>
            <th className="py-3 px-3 text-left font-medium text-charcoal">Type</th>
            <th className="py-3 px-3 text-left font-medium text-charcoal">Model</th>
            <th className="py-3 px-3 text-left font-medium text-charcoal">Prompt</th>
            <th className="py-3 px-3 text-left font-medium text-charcoal">Result</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)]">
              <td className="py-2 px-3 text-secondary text-xs whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="py-2 px-3">{log.log_type}</td>
              <td className="py-2 px-3">{log.model_used}</td>
              <td className="py-2 px-3 max-w-xs">
                <span className="line-clamp-2 text-secondary font-mono text-xs">{log.prompt_sent ?? "—"}</span>
              </td>
              <td className="py-2 px-3 max-w-xs">
                <span className="line-clamp-2 text-secondary text-xs">{log.result_preview ?? "—"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
