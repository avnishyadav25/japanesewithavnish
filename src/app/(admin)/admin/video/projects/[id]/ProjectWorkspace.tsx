"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminCard } from "@/components/admin/AdminCard";
import { FORMAT_SPECS, NARRATION_LANG_LABELS } from "@/lib/video/types";
import { arrayMove } from "@dnd-kit/sortable";
import type {
  NarrationLang,
  Scene,
  Storyboard,
  VideoFormat,
  VideoProjectRow,
  VideoRenderJobRow,
  VideoThemeTokens,
} from "@/lib/video/types";
import type { RenderRow, StoryboardRow } from "@/lib/video/projects";
import { StoryboardPlayer, type PlayerHandle } from "./StoryboardPlayer";
import { Timeline, usePlayerTime } from "./Timeline";
import { PromptPanel, type GenerateOverrides } from "./PromptPanel";

interface Props {
  project: VideoProjectRow;
  storyboards: StoryboardRow[];
  initialJobs: VideoRenderJobRow[];
  initialRenders: RenderRow[];
  themeTokens: Record<string, unknown> | null;
  bgmUrl: string | null;
  bgmTitle: string | null;
}

const ACTIVE_JOB_STATUSES = new Set(["queued", "claimed", "running"]);

export function ProjectWorkspace({
  project,
  storyboards,
  initialJobs,
  initialRenders,
  themeTokens,
  bgmUrl,
  bgmTitle,
}: Props) {
  const router = useRouter();

  const [lang, setLang] = useState<NarrationLang>(project.narrationLangs[0] ?? "en");
  const [previewFormat, setPreviewFormat] = useState<VideoFormat>(project.formats[0] ?? "vertical");
  const [jobs, setJobs] = useState(initialJobs);
  const [renders, setRenders] = useState(initialRenders);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [previewBgm, setPreviewBgm] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const playerRef = useRef<PlayerHandle | null>(null);
  const playheadSeconds = usePlayerTime(playerRef, FORMAT_SPECS[previewFormat].fps);

  // Versions for the selected language, newest first. The first non-superseded one is what the
  // editor opens on.
  const langStoryboards = useMemo(
    () => storyboards.filter((s) => s.narrationLang === lang).sort((a, b) => b.version - a.version),
    [storyboards, lang]
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const selected = langStoryboards.find((s) => s.id === selectedVersionId) ?? langStoryboards[0] ?? null;

  // Local edit buffer. Keyed by storyboard id so switching versions or languages discards
  // rather than silently carrying edits across.
  const [draft, setDraft] = useState<Storyboard | null>(null);
  const draftFor = useRef<string | null>(null);
  useEffect(() => {
    if (selected && draftFor.current !== selected.id) {
      draftFor.current = selected.id;
      setDraft(structuredClone(selected.doc));
      setRestoredDraft(false);
      setDraftSavedAt(null);

      // An autosaved draft outranks the stored doc — it is strictly newer, and losing it is
      // exactly the failure autosave exists to prevent. Restoring is silent but announced.
      void (async () => {
        const res = await fetch(`/api/admin/video/storyboards/${selected.id}/draft`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.draft?.doc?.scenes) return;
        if (draftFor.current !== selected.id) return; // switched away while fetching
        setDraft(data.draft.doc);
        setRestoredDraft(true);
        setDraftSavedAt(data.draft.updatedAt);
      })();
    }
    if (!selected) {
      draftFor.current = null;
      setDraft(null);
    }
  }, [selected]);

  const dirty = useMemo(() => {
    if (!selected || !draft) return false;
    return JSON.stringify(draft.scenes) !== JSON.stringify(selected.doc.scenes);
  }, [draft, selected]);

  /**
   * Autosave.
   *
   * Debounced, and only while the draft actually differs from the stored version — so simply
   * opening a script writes nothing. Saves to a draft slot rather than creating a version:
   * an autosave every two seconds would leave dozens of numbered versions behind after one
   * editing session.
   */
  useEffect(() => {
    if (!selected || !draft || !dirty) return;
    const timer = setTimeout(() => {
      void fetch(`/api/admin/video/storyboards/${selected.id}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: draft, baseVersion: selected.version }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setDraftSavedAt(data.savedAt))
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [draft, dirty, selected]);

  const hasActiveJob = jobs.some((j) => ACTIVE_JOB_STATUSES.has(j.status));

  // Poll while anything is in flight. No SSE anywhere in this codebase; the practice-test
  // generator and the review runs page both poll the same way.
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/video/jobs?projectId=${project.id}&includeRenders=true`);
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data.jobs ?? []);
    if (data.renders) setRenders(data.renders);
  }, [project.id]);

  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [hasActiveJob, refresh]);

  // A job finishing changes project status and the storyboard's resolved timeline, both of
  // which are server-rendered — so re-fetch the page once the queue goes quiet.
  const wasActive = useRef(hasActiveJob);
  useEffect(() => {
    if (wasActive.current && !hasActiveJob) router.refresh();
    wasActive.current = hasActiveJob;
  }, [hasActiveJob, router]);

  async function call(action: string, url: string, body?: unknown) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: body === undefined ? "POST" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function generate(regenerate: boolean, overrides?: GenerateOverrides) {
    const tone = regenerate ? window.prompt("Any steer for this rewrite? (tone, length, audience)") : null;
    if (regenerate && tone === null) return;
    const data = await call(regenerate ? "regenerate" : "generate", `/api/admin/video/projects/${project.id}/generate`, {
      narrationLang: lang,
      regenerate,
      tone: tone || undefined,
      systemPrompt: overrides?.systemPrompt,
      slotOverrides: overrides?.slotOverrides,
    });
    if (data) {
      setNotice(
        data.approvalMode === "auto"
          ? "Script generated and auto-approved by policy — ready to render."
          : "Script generated. Read it through, then approve it to unlock rendering."
      );
      router.refresh();
    }
  }

  async function saveEdits() {
    if (!selected || !draft) return;
    const data = await call("save", `/api/admin/video/storyboards/${selected.id}`, { doc: draft });
    if (data) {
      // The draft has been promoted, so stop offering to restore work that is already saved.
      await fetch(`/api/admin/video/storyboards/${selected.id}/draft`, { method: "DELETE" }).catch(() => {});
      setNotice(`Saved as version ${data.storyboard.version}. Narration you changed will be re-voiced on the next render.`);
      setSelectedVersionId(null);
      setRestoredDraft(false);
      setDraftSavedAt(null);
      draftFor.current = null;
      router.refresh();
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!selected) return;
    const reason = decision === "reject" ? window.prompt("What is wrong with this script?") : undefined;
    if (decision === "reject" && !reason) return;
    const data = await call(decision, `/api/admin/video/storyboards/${selected.id}/approve`, { decision, reason });
    if (data) {
      setNotice(decision === "approve" ? "Script approved — you can render now." : "Script rejected.");
      router.refresh();
    }
  }

  async function render() {
    if (!selected) return;
    const data = await call("render", `/api/admin/video/projects/${project.id}/render`, {
      storyboardId: selected.id,
      formats: project.formats,
    });
    if (data) {
      setNotice(`${data.message} ${data.dispatch?.detail ?? ""}`.trim());
      void refresh();
    }
  }

  async function renderAction(renderId: string, action: "approve" | "reject" | "link" | "unlink") {
    setBusy(`${action}:${renderId}`);
    setError(null);
    setNotice(null);
    try {
      const isApproval = action === "approve" || action === "reject";
      const res = await fetch(
        `/api/admin/video/renders/${renderId}/${isApproval ? "approve" : "link"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isApproval ? { decision: action } : { action }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setNotice(data.message ?? (action === "approve" ? "Video approved." : "Done."));
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Re-renders the same storyboard at the aspect ratios it does not have yet.
   *
   * Free in TTS terms — narration is cached by content hash, so a 16:9 cut of a finished 9:16
   * video costs render minutes and nothing else.
   */
  async function recut(renderId: string, currentFormat: VideoFormat) {
    const others = (["vertical", "landscape", "square", "embed"] as VideoFormat[]).filter((f) => f !== currentFormat);
    const picked = window.prompt(
      `Which other sizes? Comma-separated from: ${others.join(", ")}`,
      others.slice(0, 2).join(",")
    );
    if (!picked) return;

    setBusy(`recut:${renderId}`);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/video/renders/${renderId}/recut`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "formats", formats: picked.split(",").map((f) => f.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setNotice(data.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function jobAction(jobId: string, action: "cancel" | "retry") {
    setBusy(`${action}:${jobId}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/video/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setNotice(data.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  function updateSegment(sceneIndex: number, segmentId: string, text: string) {
    setDraft((current) => {
      if (!current) return current;
      const scenes = current.scenes.map((scene, i) =>
        i !== sceneIndex
          ? scene
          : { ...scene, narration: scene.narration.map((s) => (s.id === segmentId ? { ...s, text } : s)) }
      );
      return { ...current, scenes };
    });
  }

  function reorderScenes(from: number, to: number) {
    setDraft((current) => (current ? { ...current, scenes: arrayMove(current.scenes, from, to) } : current));
  }

  /**
   * Trimming pins the scene: durationMode flips to "fixed" so the worker stops sizing it to
   * its narration. That is the whole point of a manual trim, but it means a scene pinned
   * shorter than its voiceover will clip the audio — surfaced in the inspector rather than
   * silently prevented, because cutting a trailing beat short is a legitimate edit.
   */
  function trimScene(sceneId: string, seconds: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        scenes: current.scenes.map((scene) =>
          scene.id === sceneId ? { ...scene, durationMode: "fixed" as const, durationSeconds: seconds } : scene
        ),
      };
    });
  }

  /** Jumps the Player to a scene's first frame, so clicking a clip shows that scene. */
  function seekToSeconds(seconds: number) {
    playerRef.current?.seekTo(Math.round(seconds * FORMAT_SPECS[previewFormat].fps));
  }

  function selectScene(sceneId: string) {
    setSelectedSceneId(sceneId);
    if (!draft) return;
    let cursor = 0;
    for (const scene of draft.scenes) {
      if (scene.id === sceneId) break;
      cursor += scene.durationMode === "fixed" ? scene.durationSeconds : sceneDurationEstimate(scene);
    }
    seekToSeconds(cursor);
    document.getElementById(`scene-${sceneId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function unpinScene(sceneId: string) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        scenes: current.scenes.map((scene) =>
          scene.id === sceneId ? { ...scene, durationMode: "auto" as const } : scene
        ),
      };
    });
  }

  function moveScene(index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.scenes.length) return current;
      const scenes = [...current.scenes];
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { ...current, scenes };
    });
  }

  function deleteScene(index: number) {
    setDraft((current) => {
      if (!current || current.scenes.length <= 1) return current;
      return { ...current, scenes: current.scenes.filter((_, i) => i !== index) };
    });
  }

  const canRender = selected?.approvalStatus === "approved";

  return (
    <div className="space-y-6">
      {restoredDraft && (
        <div className="rounded-card px-4 py-3 text-sm border bg-amber-50 border-amber-200 text-amber-800">
          Restored unsaved edits from your last session. Save them as a new version, or discard them
          to go back to version {selected?.version}.
        </div>
      )}

      {(error || notice) && (
        <div
          className={`rounded-card px-4 py-3 text-sm border ${
            error ? "bg-red-light border-red-200 text-primary" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {error ?? notice}
        </div>
      )}

      {project.narrationLangs.length > 1 && (
        <div className="flex gap-2">
          {project.narrationLangs.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setSelectedVersionId(null);
              }}
              className={`px-3 py-1.5 rounded-button text-sm border transition ${
                lang === l ? "border-primary bg-red-light text-primary font-semibold" : "border-[var(--divider)] text-secondary"
              }`}
            >
              {NARRATION_LANG_LABELS[l]}
            </button>
          ))}
        </div>
      )}

      {!selected ? (
        <PromptPanel
          projectId={project.id}
          narrationLang={lang}
          disabled={busy !== null}
          onGenerate={(overrides) => generate(false, overrides)}
        />
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-6 items-start">
          {/* -------- Preview -------- */}
          <div className="space-y-3 lg:sticky lg:top-6">
            <AdminCard>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {project.formats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setPreviewFormat(format)}
                    className={`px-2 py-1 rounded-badge text-xs border transition ${
                      previewFormat === format
                        ? "border-primary bg-red-light text-primary font-semibold"
                        : "border-[var(--divider)] text-secondary"
                    }`}
                  >
                    {FORMAT_SPECS[format].width}×{FORMAT_SPECS[format].height}
                  </button>
                ))}
              </div>
              {draft && (
                <StoryboardPlayer
                  storyboard={draft}
                  format={previewFormat}
                  themeTokens={(themeTokens as Partial<VideoThemeTokens>) ?? null}
                  playerRef={playerRef}
                  bgmUrl={bgmUrl}
                  previewBgm={previewBgm}
                />
              )}
              <p className="text-xs text-secondary mt-2">
                {draft?.resolved
                  ? "Timing from measured voiceover — this matches the rendered file."
                  : "Provisional timing. Exact scene lengths are set from the voiceover during the first render."}
              </p>
              {bgmUrl && (
                <label className="flex items-center gap-2 text-xs text-secondary mt-2">
                  <input type="checkbox" checked={previewBgm} onChange={(e) => setPreviewBgm(e.target.checked)} />
                  {/* Off by default because every seek restarts the track, which makes scrubbing
                      unpleasant. The render always includes it either way. */}
                  Play “{bgmTitle}” in the preview
                </label>
              )}
            </AdminCard>

            <AdminCard>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-charcoal">
                  Version {selected.version}
                  <span className="ml-2">
                    <StatusBadge status={selected.approvalStatus} />
                  </span>
                </div>
                {langStoryboards.length > 1 && (
                  <select
                    className="text-xs border border-[var(--divider)] rounded-button px-2 py-1"
                    value={selected.id}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                  >
                    {langStoryboards.map((s) => (
                      <option key={s.id} value={s.id}>
                        v{s.version} · {s.source.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.approvalStatus !== "approved" && (
                  <button type="button" onClick={() => decide("approve")} disabled={busy !== null} className="btn-primary text-sm disabled:opacity-50">
                    Approve script
                  </button>
                )}
                {selected.approvalStatus === "pending_review" && (
                  <button
                    type="button"
                    onClick={() => decide("reject")}
                    disabled={busy !== null}
                    className="text-sm px-3 py-2 rounded-button border border-[var(--divider)] text-secondary hover:border-primary disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  onClick={render}
                  disabled={busy !== null || !canRender}
                  title={canRender ? undefined : "Approve the script first"}
                  className="btn-primary text-sm disabled:opacity-40"
                >
                  {busy === "render" ? "Queueing…" : `Render ${project.formats.length} format${project.formats.length === 1 ? "" : "s"}`}
                </button>
                <button
                  type="button"
                  onClick={() => generate(true)}
                  disabled={busy !== null}
                  className="text-sm px-3 py-2 rounded-button border border-[var(--divider)] text-secondary hover:border-primary disabled:opacity-50"
                >
                  Rewrite
                </button>
              </div>

              {selected.estimatedCostUsd !== null && (
                <p className="text-xs text-secondary mt-3">
                  Script cost ${selected.estimatedCostUsd.toFixed(4)} · {selected.llmModel}
                </p>
              )}
            </AdminCard>
          </div>

          {/* -------- Scene editor --------
              min-w-0 is load-bearing. A grid item defaults to min-width:auto, so this track
              cannot shrink below its content's min-content width — and the Timeline's inner
              strip is `total * pixelsPerSecond` wide, over 3000px for a two-minute video. Without
              it the 1fr track expands to fit the strip, the minmax(0,380px) preview column
              collapses to 0, and the whole page scrolls sideways. The strip is meant to scroll
              inside its own overflow-x-auto wrapper instead. */}
          <div className="space-y-4 min-w-0">
            {draft && (
              <Timeline
                storyboard={draft}
                selectedSceneId={selectedSceneId}
                currentSeconds={playheadSeconds}
                onSelect={selectScene}
                onSeek={seekToSeconds}
                onReorder={reorderScenes}
                onTrim={trimScene}
              />
            )}

            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold text-charcoal">
                Scenes ({draft?.scenes.length ?? 0})
              </h2>
              {dirty && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary">
                    {draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : "Saving draft…"}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setDraft(structuredClone(selected.doc));
                      setRestoredDraft(false);
                      setDraftSavedAt(null);
                      await fetch(`/api/admin/video/storyboards/${selected.id}/draft`, { method: "DELETE" }).catch(() => {});
                    }}
                    className="text-sm px-3 py-1.5 rounded-button border border-[var(--divider)] text-secondary"
                  >
                    Discard
                  </button>
                  <button type="button" onClick={saveEdits} disabled={busy !== null} className="btn-primary text-sm disabled:opacity-50">
                    {busy === "save" ? "Saving…" : "Save as new version"}
                  </button>
                </div>
              )}
            </div>

            {draft?.scenes.map((scene, index) => (
              <SceneEditor
                key={scene.id}
                scene={scene}
                index={index}
                total={draft.scenes.length}
                selected={scene.id === selectedSceneId}
                onSelect={() => selectScene(scene.id)}
                onUnpin={() => unpinScene(scene.id)}
                onChangeSegment={(segmentId, text) => updateSegment(index, segmentId, text)}
                onMove={(dir) => moveScene(index, dir)}
                onDelete={() => deleteScene(index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* -------- Jobs -------- */}
      {jobs.length > 0 && (
        <AdminCard>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Render jobs</h2>
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="border border-[var(--divider)] rounded-card p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <StatusBadge status={job.status} />
                    <span className="text-charcoal font-medium">{job.format}</span>
                    {job.stage && <span className="text-secondary">· {job.stage}</span>}
                    {job.runner && <span className="text-secondary text-xs">· {job.runner}</span>}
                    {job.attemptCount > 1 && (
                      <span className="text-secondary text-xs">· attempt {job.attemptCount}/{job.maxAttempts}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {ACTIVE_JOB_STATUSES.has(job.status) && (
                      <button
                        type="button"
                        onClick={() => jobAction(job.id, "cancel")}
                        disabled={busy !== null}
                        className="text-xs px-2 py-1 rounded-button border border-[var(--divider)] text-secondary disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {(job.status === "failed" || job.status === "cancelled") && (
                      <button
                        type="button"
                        onClick={() => jobAction(job.id, "retry")}
                        disabled={busy !== null}
                        className="text-xs px-2 py-1 rounded-button border border-[var(--divider)] text-secondary disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>

                {ACTIVE_JOB_STATUSES.has(job.status) && (
                  <div className="h-2 bg-base rounded-badge overflow-hidden mb-2">
                    <div className="h-full bg-primary transition-all" style={{ width: `${job.progressPct}%` }} />
                  </div>
                )}

                {job.errorMessage && <p className="text-xs text-primary mb-1 break-words">{job.errorMessage}</p>}

                {job.log.length > 0 && (
                  <ul className="text-xs text-secondary space-y-0.5 max-h-28 overflow-y-auto">
                    {job.log.slice(-6).map((line, i) => (
                      <li key={i}>{line.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* -------- Renders -------- */}
      {renders.length > 0 && (
        <AdminCard>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Finished videos</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renders.map((render) => (
              <div key={render.id} className="border border-[var(--divider)] rounded-card overflow-hidden">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions ship as a
                    separate .srt and are also burned into the frame */}
                <video
                  src={render.videoUrl}
                  poster={render.posterUrl ?? undefined}
                  controls
                  preload="none"
                  className="w-full bg-black"
                />
                <div className="p-3 text-xs text-secondary space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-charcoal font-medium">
                      {render.format} · {render.narrationLang}
                    </span>
                    {!render.isCurrent && <StatusBadge status="superseded" />}
                    {render.approvalStatus === "pending_review" && <StatusBadge status="pending_review" />}
                  </div>
                  <div>
                    {render.width}×{render.height} ·{" "}
                    {render.durationSeconds ? `${render.durationSeconds.toFixed(1)}s` : "—"} ·{" "}
                    {render.fileSizeBytes ? `${(render.fileSizeBytes / 1_000_000).toFixed(1)} MB` : "—"}
                  </div>
                  <div className="flex gap-3 pt-1 flex-wrap">
                    <a href={render.videoUrl} download className="text-primary hover:underline">
                      Download
                    </a>
                    {render.srtUrl && (
                      <a href={render.srtUrl} download className="text-primary hover:underline">
                        Captions
                      </a>
                    )}
                    {render.approvalStatus === "pending_review" && (
                      <>
                        <button
                          type="button"
                          onClick={() => renderAction(render.id, "approve")}
                          disabled={busy !== null}
                          className="text-primary hover:underline disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => renderAction(render.id, "reject")}
                          disabled={busy !== null}
                          className="text-secondary hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {render.isCurrent && render.approvalStatus !== "pending_review" && render.approvalStatus !== "rejected" && (
                      <>
                        <button
                          type="button"
                          onClick={() => renderAction(render.id, "link")}
                          disabled={busy !== null}
                          title="Embeds this video on the content page it was generated from, with VideoObject schema"
                          className="text-primary hover:underline disabled:opacity-50"
                        >
                          Publish to site
                        </button>
                        <button
                          type="button"
                          onClick={() => recut(render.id, render.format)}
                          disabled={busy !== null}
                          title="Renders the same script at the other aspect ratios. The voiceover is cached, so this costs render time only."
                          className="text-primary hover:underline disabled:opacity-50"
                        >
                          Other sizes
                        </button>
                        {/* Deliberately a plain link, not a panel: this file already carries the
                            storyboard editor, the job list and the render list, and a social UI
                            growing inside it would make every future video change riskier. */}
                        <a
                          href={`/admin/social/briefs/new?renderId=${render.id}`}
                          title="Writes captions, titles and descriptions for every platform, in English and Hinglish, and tracks where each one gets posted"
                          className="text-primary hover:underline"
                        >
                          Promote
                        </a>
                      </>
                    )}
                  </div>

                  {/* Where this render has actually been distributed. The on-site embed is
                      counted separately by "Publish to site" — conflating the two would hide
                      exactly the gap this line exists to show. */}
                  {render.isCurrent && (
                    <p className="mt-2 text-xs text-secondary">
                      {render.publications && render.publications.length > 0 ? (
                        <>
                          Posted:{" "}
                          {render.publications.map((p, i) => (
                            <span key={p.platform}>
                              {i > 0 && " · "}
                              {p.url ? (
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {p.platform}
                                </a>
                              ) : (
                                <span title={p.status}>
                                  {p.platform} ({p.status.replace(/_/g, " ")})
                                </span>
                              )}
                            </span>
                          ))}
                        </>
                      ) : (
                        "Not posted anywhere yet"
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  );
}

function SceneEditor({
  scene,
  index,
  total,
  selected,
  onSelect,
  onUnpin,
  onChangeSegment,
  onMove,
  onDelete,
}: {
  scene: Scene;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onUnpin: () => void;
  onChangeSegment: (segmentId: string, text: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const headline = sceneHeadline(scene);
  const narrationSeconds = scene.narration.reduce(
    (sum, seg) => sum + (seg.leadInSeconds ?? 0) + (seg.audio?.durationSeconds ?? 0),
    0
  );
  // A pinned scene shorter than its voiceover will cut the audio off. Allowed — sometimes you
  // want the tail clipped — but it should never be a surprise.
  const clipsAudio = scene.durationMode === "fixed" && narrationSeconds > 0 && scene.durationSeconds < narrationSeconds - 0.05;

  return (
    <div
      id={`scene-${scene.id}`}
      onClick={onSelect}
      className={`border rounded-card p-4 transition cursor-pointer ${
        selected ? "border-charcoal shadow-card" : "border-[var(--divider)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-secondary uppercase tracking-wider">
            {index + 1}. {scene.sceneType.replace(/_/g, " ")}
            {scene.durationMode === "fixed" && (
              <span className="ml-2 normal-case tracking-normal">
                pinned to {scene.durationSeconds.toFixed(1)}s ·{" "}
                <button type="button" onClick={(e) => { e.stopPropagation(); onUnpin(); }} className="text-primary hover:underline">
                  unpin
                </button>
              </span>
            )}
          </div>
          {headline && <div className="font-heading font-bold text-charcoal">{headline}</div>}
          {clipsAudio && (
            <div className="text-xs text-primary mt-1">
              Pinned shorter than its {narrationSeconds.toFixed(1)}s of voiceover — the audio will be cut off.
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move scene up"
            className="w-7 h-7 rounded-button border border-[var(--divider)] text-secondary disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move scene down"
            className="w-7 h-7 rounded-button border border-[var(--divider)] text-secondary disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={total <= 1}
            aria-label="Delete scene"
            className="w-7 h-7 rounded-button border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary disabled:opacity-30"
          >
            ×
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {scene.narration.map((segment) =>
          segment.lang === "ja" ? (
            // Japanese segments come straight from the database and are spoken by a native
            // voice using the stored kana reading. Editing them here would let a typo become
            // a mispronunciation in a teaching video, so they are read-only — fix the source
            // content instead.
            <div key={segment.id} className="flex items-start gap-2 bg-base rounded-button px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-secondary shrink-0 mt-1">JA</span>
              <div className="text-sm text-charcoal">
                {segment.text}
                {segment.spokenAs && segment.spokenAs !== segment.text && (
                  <span className="text-secondary text-xs ml-2">read as {segment.spokenAs}</span>
                )}
              </div>
            </div>
          ) : (
            <div key={segment.id} className="flex items-start gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-secondary shrink-0 mt-2.5">
                {segment.lang}
              </span>
              <textarea
                value={segment.text}
                onChange={(e) => onChangeSegment(segment.id, e.target.value)}
                rows={Math.max(2, Math.ceil(segment.text.length / 70))}
                className="w-full text-sm border border-[var(--divider)] rounded-button px-3 py-2 focus:outline-none focus:border-primary resize-y"
              />
            </div>
          )
        )}
        {scene.narration.length === 0 && <p className="text-xs text-secondary italic">No narration — silent scene.</p>}
      </div>
    </div>
  );
}

/** Mirrors resolveSceneDuration() for the auto case, so clicking a clip seeks to the same
 * place the timeline drew it. */
function sceneDurationEstimate(scene: Scene): number {
  const narration = scene.narration.reduce(
    (sum, seg) => sum + (seg.leadInSeconds ?? 0) + (seg.audio?.durationSeconds ?? 0),
    0
  );
  return narration > 0 ? narration + 0.45 : Math.max(scene.durationSeconds || 1.2, 1.2);
}

/** A short human label for a scene, pulled out of whichever visual field carries its identity. */
function sceneHeadline(scene: Scene): string | null {
  const v = scene.visual as unknown as Record<string, unknown>;
  if (typeof v.title === "string") return v.title;
  if (typeof v.heading === "string") return v.heading;
  if (typeof v.pattern === "string") return v.pattern;
  if (typeof v.character === "string") return v.character;
  if (typeof v.question === "string") return v.question;
  if (typeof v.headline === "string") return v.headline;
  const item = v.item as { word?: string; meaning?: string } | undefined;
  if (item?.word) return `${item.word}${item.meaning ? ` — ${item.meaning}` : ""}`;
  const sentences = v.sentences as { ja?: string }[] | undefined;
  if (sentences?.[0]?.ja) return sentences[0].ja;
  return null;
}
