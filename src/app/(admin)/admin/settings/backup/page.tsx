"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";

type SyncState = {
  status: "idle" | "running" | "completed" | "error";
  run_started_at: string | null;
  run_completed_at: string | null;
  total_tables: number;
  next_table_offset: number;
  tables_synced_ok: number;
  tables_synced_failed: number;
  last_error: string | null;
};

type LogRow = {
  run_started_at: string;
  table_name: string;
  row_count: number;
  supabase_ok: boolean;
  turso_ok: boolean;
  r2_ok: boolean;
  error: string | null;
  synced_at: string;
};

export default function AdminBackupPage() {
  const [state, setState] = useState<SyncState | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backup/sync");
      const data = await res.json();
      if (res.ok) {
        setState(data.state);
        setLog(data.recentLog ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleSyncNow() {
    setSyncing(true);
    setError("");
    try {
      // Keep calling the batch endpoint until the run reports "completed" (or "idle" if
      // it's within the 20h cooldown from a prior completed run — force bypasses that).
      let done = false;
      let guard = 0;
      while (!done && guard < 40) {
        guard++;
        const res = await fetch("/api/admin/backup/sync", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sync batch failed");
        await fetchStatus();
        done = data.status === "completed" || data.status === "idle";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const progressPct = state && state.total_tables > 0 ? Math.round((state.next_table_offset / state.total_tables) * 100) : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Database Backup"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Settings", href: "/admin/settings" }, { label: "Backup" }]}
      />
      <p className="text-secondary text-sm max-w-2xl">
        Full backup of every Neon table to Supabase, Turso, and Cloudflare R2 (JSON snapshots), plus a
        Google Sheet summary. Runs automatically via an hourly Vercel Cron ping to{" "}
        <code className="bg-base px-1 rounded">/api/cron/backup-sync</code>, which processes a few tables per
        call and resumes until the full sync completes, then idles for the rest of the day (20h cooldown) — so a
        fresh full backup completes roughly once every 24 hours. Use the button below to run it manually on demand
        and watch progress live.
      </p>

      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-heading font-semibold text-charcoal">
              Status: {loading ? "Loading…" : state?.status ?? "unknown"}
            </h3>
            {state?.run_started_at && (
              <p className="text-secondary text-xs mt-1">
                Run started {new Date(state.run_started_at).toLocaleString()}
                {state.run_completed_at && <> · completed {new Date(state.run_completed_at).toLocaleString()}</>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing}
            className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>

        {state && state.total_tables > 0 && (
          <div className="mb-4">
            <div className="w-full h-2 bg-base rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-secondary text-xs mt-1">
              {state.next_table_offset} / {state.total_tables} tables ({state.tables_synced_ok} ok,{" "}
              {state.tables_synced_failed} failed)
            </p>
          </div>
        )}

        {error && <p className="text-[#D0021B] text-sm">{error}</p>}
        {state?.last_error && <p className="text-[#D0021B] text-sm">{state.last_error}</p>}
      </AdminCard>

      <AdminCard>
        <h3 className="font-heading font-semibold text-charcoal mb-3">Recent table sync log</h3>
        {log.length === 0 ? (
          <p className="text-secondary text-sm py-4 text-center">No sync runs yet.</p>
        ) : (
          <AdminTable headers={["Table", "Rows", "Supabase", "Turso", "R2", "Synced at"]}>
            {log.map((row, i) => (
              <tr key={`${row.table_name}-${row.synced_at}-${i}`} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 text-charcoal font-medium">{row.table_name}</td>
                <td className="py-2 px-2 text-secondary">{row.row_count}</td>
                <td className="py-2 px-2">{row.supabase_ok ? "✅" : "❌"}</td>
                <td className="py-2 px-2">{row.turso_ok ? "✅" : "❌"}</td>
                <td className="py-2 px-2">{row.r2_ok ? "✅" : "❌"}</td>
                <td className="py-2 px-2 text-secondary text-xs">{new Date(row.synced_at).toLocaleString()}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>
    </div>
  );
}
