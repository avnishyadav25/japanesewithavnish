"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";

/**
 * The header for one `video_per_item` batch, and the button that writes all its scripts.
 *
 * WHY A CLIENT LOOP AND NOT A SERVER FAN-OUT. Ten scripts is ten DeepSeek calls, and the generate
 * route lives behind a ~30s function ceiling — the same constraint that makes an oversized single
 * scope refuse. So the batch is generated one request at a time from the browser, with progress
 * visible and the ability to stop. It is the pattern the wizard already uses to generate several
 * narration languages.
 *
 * Failures do not abort the run. One item whose scope resolved badly should not stop the other
 * nine; it is reported at the end and can be retried on its own.
 */
export function BatchPanel({
  batchId,
  projects,
}: {
  batchId: string;
  projects: { id: string; title: string; storyboardCount: number; status: string }[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failures, setFailures] = useState<{ title: string; error: string }[]>([]);
  // A ref, not state: the loop below closes over its variables at call time, so a `stopped`
  // state value read inside it would always be the value from before the run started and the
  // Stop button would silently do nothing.
  const stopRef = useRef(false);
  const [stopped, setStopped] = useState(false);

  const pending = projects.filter((p) => p.storyboardCount === 0);
  const rendered = projects.filter((p) => p.status === "render_ready" || p.status === "published").length;

  async function generateAll() {
    setRunning(true);
    setDone(0);
    setFailures([]);
    setStopped(false);
    stopRef.current = false;

    const failed: { title: string; error: string }[] = [];
    for (const project of pending) {
      if (stopRef.current) break;
      try {
        const res = await fetch(`/api/admin/video/projects/${project.id}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `${res.status}`);
      } catch (err) {
        failed.push({ title: project.title, error: err instanceof Error ? err.message : "Failed" });
      }
      setDone((n) => n + 1);
      setFailures([...failed]);
    }

    setRunning(false);
    router.refresh();
  }

  return (
    <AdminCard className="mb-5 border-l-4 border-primary">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-charcoal">
            One batch · {projects.length} video{projects.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-secondary mt-0.5">
            {pending.length} without a script · {rendered} rendered ·{" "}
            <a href="/admin/video/projects" className="text-primary hover:underline">
              show all projects
            </a>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {running && (
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
                setStopped(true);
              }}
              className="text-sm text-secondary hover:text-charcoal"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={generateAll}
            disabled={running || pending.length === 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {running
              ? `Generating ${done}/${pending.length}…`
              : pending.length === 0
                ? "All scripts written"
                : `Generate ${pending.length} script${pending.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {running && (
        <div className="mt-3 h-1.5 bg-base rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${pending.length === 0 ? 0 : (done / pending.length) * 100}%` }}
          />
        </div>
      )}

      {!running && done > 0 && (
        <p className="mt-3 text-xs text-secondary">
          {done - failures.length} written{failures.length > 0 ? `, ${failures.length} failed` : ""}.
          {stopped ? " Stopped early — run it again to finish." : ""}
        </p>
      )}

      {failures.length > 0 && (
        <ul className="mt-2 text-xs text-primary space-y-0.5">
          {failures.map((f) => (
            <li key={f.title}>
              {f.title}: {f.error}
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
