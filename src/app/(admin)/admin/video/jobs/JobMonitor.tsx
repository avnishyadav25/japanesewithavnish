"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { VideoRenderJobRow } from "@/lib/video/types";

const ACTIVE = new Set(["queued", "claimed", "running"]);

export function JobMonitor() {
  const [jobs, setJobs] = useState<VideoRenderJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/video/jobs?limit=100");
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll only while something is moving — an idle queue does not need a request every 3s.
  const hasActive = jobs.some((j) => ACTIVE.has(j.status));
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [hasActive, load]);

  async function act(jobId: string, action: "cancel" | "retry") {
    setBusy(jobId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/video/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setMessage(res.ok ? data.message : data.error);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <AdminCard>Loading queue…</AdminCard>;
  if (jobs.length === 0) return <AdminEmptyState message="Nothing in the render queue." />;

  const active = jobs.filter((j) => ACTIVE.has(j.status));
  const done = jobs.filter((j) => !ACTIVE.has(j.status));

  return (
    <div className="space-y-6">
      {message && <div className="rounded-card px-4 py-3 text-sm border border-[var(--divider)] text-secondary">{message}</div>}

      <section>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Active ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-secondary text-sm">Nothing running.</p>
        ) : (
          <div className="space-y-3">
            {active.map((job) => (
              <JobCard key={job.id} job={job} busy={busy === job.id} onAction={act} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Recent ({done.length})</h2>
        <div className="space-y-3">
          {done.map((job) => (
            <JobCard key={job.id} job={job} busy={busy === job.id} onAction={act} />
          ))}
        </div>
      </section>
    </div>
  );
}

function JobCard({
  job,
  busy,
  onAction,
}: {
  job: VideoRenderJobRow;
  busy: boolean;
  onAction: (jobId: string, action: "cancel" | "retry") => void;
}) {
  // A claimed job whose heartbeat has gone quiet is almost always a killed worker; the queue
  // will reclaim it after five minutes, but saying so beats the admin staring at a stuck bar.
  const heartbeatAgeMs = job.heartbeatAt ? Date.now() - new Date(job.heartbeatAt).getTime() : null;
  const looksStalled = ACTIVE.has(job.status) && job.status !== "queued" && heartbeatAgeMs !== null && heartbeatAgeMs > 120_000;

  return (
    <AdminCard>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <StatusBadge status={job.status} />
          <span className="font-medium text-charcoal">{job.format}</span>
          {job.stage && <span className="text-secondary">· {job.stage}</span>}
          {job.runner && <span className="text-secondary text-xs">· {job.runner}{job.runnerId ? ` (${job.runnerId})` : ""}</span>}
          {job.attemptCount > 1 && (
            <span className="text-secondary text-xs">· attempt {job.attemptCount}/{job.maxAttempts}</span>
          )}
          <Link href={`/admin/video/projects/${job.projectId}`} className="text-primary hover:underline text-xs">
            open project
          </Link>
        </div>
        <div className="flex gap-2">
          {ACTIVE.has(job.status) && (
            <button
              type="button"
              onClick={() => onAction(job.id, "cancel")}
              disabled={busy}
              className="text-xs px-2 py-1 rounded-button border border-[var(--divider)] text-secondary disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {(job.status === "failed" || job.status === "cancelled") && (
            <button
              type="button"
              onClick={() => onAction(job.id, "retry")}
              disabled={busy}
              className="text-xs px-2 py-1 rounded-button border border-[var(--divider)] text-secondary disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {ACTIVE.has(job.status) && (
        <div className="h-2 bg-base rounded-badge overflow-hidden mb-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${job.progressPct}%` }} />
        </div>
      )}

      {looksStalled && (
        <p className="text-xs text-amber-700 mb-1">
          No heartbeat for {Math.round(heartbeatAgeMs! / 60000)} minutes — the worker probably died. The queue reclaims
          it automatically after five.
        </p>
      )}

      {job.errorMessage && <p className="text-xs text-primary break-words mb-1">{job.errorMessage}</p>}

      {job.log.length > 0 && (
        <ul className="text-xs text-secondary space-y-0.5 max-h-32 overflow-y-auto">
          {job.log.slice(-8).map((line, i) => (
            <li key={i}>
              <span className="opacity-60">{new Date(line.at).toLocaleTimeString()}</span> {line.message}
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
