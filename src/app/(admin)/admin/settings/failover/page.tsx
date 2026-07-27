"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";

type DbProvider = "neon" | "supabase";

type ProviderHealth = {
  configured: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  error?: string;
};

type TableLag = {
  table: string;
  lastSyncedAt: string | null;
  lagSeconds: number | null;
  rowsSyncedTotal: number;
  lastError: string | null;
};

type SchemaParity = { ok: boolean; missingInSupabase: string[]; missingInNeon: string[]; mismatchCount: number } | { error: string };

type Status = {
  activeProvider: DbProvider;
  standbyProvider: DbProvider;
  providers: Record<DbProvider, ProviderHealth>;
  replicationLag: TableLag[] | null;
  schemaParity: SchemaParity;
  usage: { neon: unknown; supabase: unknown };
};

export default function AdminFailoverPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/db-failover/status");
      const data = await res.json();
      if (res.ok) setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleSwitch(target: DbProvider, force = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/db-failover/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Switch failed");
      setMessage(`Switched to ${target}.`);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRejoin(provider: DbProvider) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let caughtUp = false;
      let guard = 0;
      let resetCursor = true;
      while (!caughtUp && guard < 60) {
        guard++;
        const res = await fetch("/api/admin/db-failover/rejoin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, resetCursor }),
        });
        resetCursor = false;
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Rejoin failed");
        caughtUp = data.caughtUp;
      }
      setMessage(caughtUp ? `${provider} rejoined as standby.` : "Rejoin still in progress — try again.");
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejoin failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Database Failover"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Settings", href: "/admin/settings" }, { label: "Failover" }]}
      />
      <p className="text-secondary text-sm max-w-2xl">
        Live admin-controlled failover between Neon and Supabase (both Postgres). A tight-interval
        polling sync (<code className="bg-base px-1 rounded">/api/cron/replication-poll</code>, every ~10-15s) keeps
        payments/progress/gamification tables current on the standby. Turso stays a separate, cold
        emergency copy — it is not a live switch target.
      </p>

      {loading ? (
        <AdminCard>Loading…</AdminCard>
      ) : !status ? (
        <AdminCard>Could not load status.</AdminCard>
      ) : (
        <>
          <AdminCard>
            <h3 className="font-heading font-semibold text-charcoal mb-3">
              Active provider: <span className="text-primary">{status.activeProvider}</span>
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {(["neon", "supabase"] as DbProvider[]).map((p) => {
                const health = status.providers[p];
                const isActive = status.activeProvider === p;
                return (
                  <div key={p} className="border border-[var(--divider)] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-charcoal capitalize">
                        {p} {isActive && <span className="text-xs text-primary">(active)</span>}
                      </span>
                      <span>
                        {!health.configured ? "⚪ not configured" : health.reachable ? "✅ reachable" : "❌ unreachable"}
                      </span>
                    </div>
                    {health.latencyMs !== null && <p className="text-secondary text-xs">Latency: {health.latencyMs}ms</p>}
                    {health.error && <p className="text-[#D0021B] text-xs">{health.error}</p>}
                    {!isActive && health.configured && (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSwitch(p)}
                          className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                        >
                          Switch to {p}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSwitch(p, true)}
                          className="text-xs py-1.5 px-3 border border-[var(--divider)] rounded disabled:opacity-50"
                          title="Switch even if unreachable/lagging — accepts possible data loss"
                        >
                          Force switch
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRejoin(p)}
                          className="text-xs py-1.5 px-3 border border-[var(--divider)] rounded disabled:opacity-50"
                          title="Full re-sync from the current primary — use after recovering a demoted/orphaned provider"
                        >
                          Rejoin as standby
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {message && <p className="text-[#2E7D32] text-sm mt-3">{message}</p>}
            {error && <p className="text-[#D0021B] text-sm mt-3">{error}</p>}
          </AdminCard>

          <AdminCard>
            <h3 className="font-heading font-semibold text-charcoal mb-3">
              Schema parity ({status.standbyProvider} vs {status.activeProvider})
            </h3>
            {"error" in status.schemaParity ? (
              <p className="text-secondary text-sm">{status.schemaParity.error}</p>
            ) : status.schemaParity.ok ? (
              <p className="text-[#2E7D32] text-sm">In parity.</p>
            ) : (
              <div className="text-sm space-y-1">
                <p className="text-[#D0021B]">
                  Drift detected — {status.schemaParity.missingInSupabase.length} table(s) missing on Supabase,{" "}
                  {status.schemaParity.missingInNeon.length} missing on Neon, {status.schemaParity.mismatchCount} column
                  mismatch(es).
                </p>
                <p className="text-secondary text-xs">
                  Run <code className="bg-base px-1 rounded">npm run db:check-parity</code> for the full table/column diff.
                </p>
              </div>
            )}
          </AdminCard>

          <AdminCard>
            <h3 className="font-heading font-semibold text-charcoal mb-3">
              Tight-replication tables (standby: {status.standbyProvider})
            </h3>
            {!status.replicationLag ? (
              <p className="text-secondary text-sm py-4 text-center">Standby not configured yet.</p>
            ) : (
              <AdminTable headers={["Table", "Lag", "Rows synced (total)", "Last error"]}>
                {status.replicationLag.map((row) => (
                  <tr key={row.table} className="border-b border-[var(--divider)]">
                    <td className="py-2 px-2 text-charcoal font-medium">{row.table}</td>
                    <td className="py-2 px-2 text-secondary">
                      {row.lagSeconds === null ? "never synced" : `${row.lagSeconds}s ago`}
                    </td>
                    <td className="py-2 px-2 text-secondary">{row.rowsSyncedTotal}</td>
                    <td className="py-2 px-2 text-[#D0021B] text-xs">{row.lastError ?? ""}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminCard>
        </>
      )}
    </div>
  );
}
