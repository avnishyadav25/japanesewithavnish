/**
 * Worker-side database access.
 *
 * Follows the house scripts/ convention of talking straight to DATABASE_URL via
 * @neondatabase/serverless rather than importing src/lib/db — that module is a Next-runtime
 * proxy with Turso-backed provider failover, and it resolves through the "@/" tsconfig alias
 * that plain tsx does not honour. The worker is a standalone process; it wants one connection
 * and no failover machinery.
 *
 * Everything here is a single statement. The Neon HTTP driver has no session state, so the
 * atomic claim below has to be expressible as one UPDATE — which it is, via a scalar subquery
 * with FOR UPDATE SKIP LOCKED.
 */
import { neon } from "@neondatabase/serverless";
import type {
  NarrationLang,
  RenderStage,
  Storyboard,
  VideoFormat,
  VideoThemeTokens,
} from "../../../src/lib/video/types";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — the render worker cannot start.");
}

export const sql = neon(process.env.DATABASE_URL);

/** A job's claim is refreshed every 30s; anything quiet for this long is assumed dead and is
 * reclaimable. Deliberately measured from heartbeat_at, not claimed_at: a 1080p render can
 * legitimately run far longer than any fixed claim timeout, and content_review_jobs' 10-minutes
 * -from-claim rule would steal healthy work mid-render. */
export const STALE_HEARTBEAT_MINUTES = 5;

export interface ClaimedJob {
  id: string;
  projectId: string;
  storyboardId: string;
  format: VideoFormat;
  attemptCount: number;
  maxAttempts: number;
}

export async function claimNextJob(runner: string, runnerId: string): Promise<ClaimedJob | null> {
  const rows = (await sql`
    UPDATE video_render_jobs
    SET status = 'claimed',
        claimed_at = NOW(),
        heartbeat_at = NOW(),
        started_at = COALESCE(started_at, NOW()),
        attempt_count = attempt_count + 1,
        runner = ${runner},
        runner_id = ${runnerId}
    WHERE id = (
      SELECT id FROM video_render_jobs
      WHERE status = 'queued'
         OR (status IN ('claimed', 'running')
             AND heartbeat_at < NOW() - make_interval(mins => ${STALE_HEARTBEAT_MINUTES}))
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, project_id, storyboard_id, format, attempt_count, max_attempts
  `) as Record<string, string | number>[];

  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    storyboardId: String(row.storyboard_id),
    format: row.format as VideoFormat,
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
  };
}

export async function heartbeat(jobId: string): Promise<void> {
  await sql`UPDATE video_render_jobs SET heartbeat_at = NOW() WHERE id = ${jobId}::uuid`;
}

export async function setStage(jobId: string, stage: RenderStage, progressPct: number): Promise<void> {
  await sql`
    UPDATE video_render_jobs
    SET status = 'running', stage = ${stage}, progress_pct = ${Math.round(progressPct)}, heartbeat_at = NOW()
    WHERE id = ${jobId}::uuid
  `;
}

/** Appends one line to the job's log. Uses jsonb || so concurrent appends can't clobber each
 * other by read-modify-writing the whole array. */
export async function appendLog(jobId: string, message: string): Promise<void> {
  const entry = JSON.stringify([{ at: new Date().toISOString(), message }]);
  await sql`
    UPDATE video_render_jobs
    SET log = log || ${entry}::jsonb, heartbeat_at = NOW()
    WHERE id = ${jobId}::uuid
  `;
}

export async function completeJob(jobId: string): Promise<void> {
  await sql`
    UPDATE video_render_jobs
    SET status = 'completed', progress_pct = 100, stage = NULL, completed_at = NOW(), error_message = NULL
    WHERE id = ${jobId}::uuid
  `;
}

/** Requeues while attempts remain, otherwise fails terminally — same policy as
 * content_review_jobs' failJob(). */
export async function failJob(job: ClaimedJob, message: string): Promise<void> {
  const truncated = message.slice(0, 2000);
  if (job.attemptCount < job.maxAttempts) {
    await sql`
      UPDATE video_render_jobs
      SET status = 'queued', error_message = ${truncated}, stage = NULL, claimed_at = NULL, heartbeat_at = NULL
      WHERE id = ${job.id}::uuid
    `;
    return;
  }
  await sql`
    UPDATE video_render_jobs
    SET status = 'failed', error_message = ${truncated}, completed_at = NOW()
    WHERE id = ${job.id}::uuid
  `;
  await sql`
    UPDATE video_projects SET status = 'failed', error_message = ${truncated}, updated_at = NOW()
    WHERE id = ${job.projectId}::uuid
  `;
}

export async function isCancelled(jobId: string): Promise<boolean> {
  const rows = (await sql`SELECT status FROM video_render_jobs WHERE id = ${jobId}::uuid`) as { status: string }[];
  return rows[0]?.status === "cancelled";
}

// ---------------------------------------------------------------------------
// Storyboard + project
// ---------------------------------------------------------------------------

export interface LoadedStoryboard {
  id: string;
  projectId: string;
  narrationLang: NarrationLang;
  doc: Storyboard;
  themeKey: string;
  themeTokens: Partial<VideoThemeTokens> | null;
  themeVoices: Partial<Record<NarrationLang, string>> | null;
  /** Per-project overrides from the wizard's voice picker. Take precedence over the theme. */
  projectVoices: Partial<Record<NarrationLang, string>> | null;
  bgmUrl: string | null;
  projectTitle: string;
}

export async function loadStoryboard(storyboardId: string): Promise<LoadedStoryboard> {
  const rows = (await sql`
    SELECT s.id, s.project_id, s.narration_lang, s.doc,
           p.title AS project_title, p.theme_key,
           t.tokens AS theme_tokens, t.default_voices AS theme_voices, p.voices AS project_voices,
           b.audio_url AS bgm_url
    FROM video_storyboards s
    JOIN video_projects p ON p.id = s.project_id
    LEFT JOIN video_themes t ON t.key = p.theme_key
    LEFT JOIN video_bgm_tracks b ON b.id = p.bgm_track_id
    WHERE s.id = ${storyboardId}::uuid
  `) as Record<string, unknown>[];

  const row = rows[0];
  if (!row) throw new Error(`Storyboard ${storyboardId} not found`);

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    narrationLang: row.narration_lang as NarrationLang,
    doc: row.doc as Storyboard,
    themeKey: String(row.theme_key),
    themeTokens: (row.theme_tokens as Partial<VideoThemeTokens> | null) ?? null,
    themeVoices: (row.theme_voices as Partial<Record<NarrationLang, string>> | null) ?? null,
    projectVoices: (row.project_voices as Partial<Record<NarrationLang, string>> | null) ?? null,
    bgmUrl: (row.bgm_url as string | null) ?? null,
    projectTitle: String(row.project_title),
  };
}

/** Persists narration audio urls + the resolved timeline back onto the storyboard, so a re-run
 * (or a second format) reuses them instead of re-measuring. */
export async function saveStoryboardDoc(storyboardId: string, doc: Storyboard): Promise<void> {
  await sql`
    UPDATE video_storyboards SET doc = ${JSON.stringify(doc)}::jsonb WHERE id = ${storyboardId}::uuid
  `;
}

export async function setProjectStatus(projectId: string, status: string): Promise<void> {
  await sql`UPDATE video_projects SET status = ${status}, updated_at = NOW() WHERE id = ${projectId}::uuid`;
}

// ---------------------------------------------------------------------------
// TTS cache (implements the TtsCache interface from src/lib/video/tts.ts)
// ---------------------------------------------------------------------------

export const ttsCache = {
  async get(textHash: string) {
    const rows = (await sql`
      SELECT id, audio_url, duration_seconds FROM video_tts_assets WHERE text_hash = ${textHash}
    `) as { id: string; audio_url: string; duration_seconds: string }[];
    const row = rows[0];
    if (!row) return null;
    // Touch last_used_at so the admin cache browser can show what is actually in play, and a
    // future pruning job has something to sort on.
    await sql`UPDATE video_tts_assets SET last_used_at = NOW() WHERE id = ${row.id}::uuid`;
    return { id: row.id, audioUrl: row.audio_url, durationSeconds: Number(row.duration_seconds) };
  },

  async put(entry: {
    textHash: string;
    langCode: string;
    voiceName: string;
    speakingRate: number;
    pitch: number;
    textPreview: string;
    audioUrl: string;
    durationSeconds: number;
    charCount: number;
    estimatedCostUsd: number;
  }) {
    // ON CONFLICT rather than a plain INSERT: two formats of the same storyboard can render
    // concurrently on two runners and race to cache the identical segment.
    const rows = (await sql`
      INSERT INTO video_tts_assets
        (text_hash, lang_code, voice_name, speaking_rate, pitch, text_preview, audio_url,
         duration_seconds, char_count, estimated_cost_usd)
      VALUES (${entry.textHash}, ${entry.langCode}, ${entry.voiceName}, ${entry.speakingRate},
              ${entry.pitch}, ${entry.textPreview}, ${entry.audioUrl}, ${entry.durationSeconds},
              ${entry.charCount}, ${entry.estimatedCostUsd})
      ON CONFLICT (text_hash) DO UPDATE SET last_used_at = NOW()
      RETURNING id, audio_url, duration_seconds
    `) as { id: string; audio_url: string; duration_seconds: string }[];
    const row = rows[0];
    return { id: row.id, audioUrl: row.audio_url, durationSeconds: Number(row.duration_seconds) };
  },
};

// ---------------------------------------------------------------------------
// Renders
// ---------------------------------------------------------------------------

export interface RenderRecord {
  jobId: string;
  projectId: string;
  storyboardId: string;
  format: VideoFormat;
  narrationLang: NarrationLang;
  videoUrl: string;
  posterUrl: string | null;
  srtUrl: string | null;
  vttUrl: string | null;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  fileSizeBytes: number;
  renderSeconds: number;
  approvalStatus: "not_required" | "pending_review";
}

export async function recordRender(record: RenderRecord): Promise<string> {
  // Supersede the previous current render for this (project, format, lang) before inserting,
  // so the partial unique index on is_current is never violated.
  await sql`
    UPDATE video_renders SET is_current = false
    WHERE project_id = ${record.projectId}::uuid
      AND format = ${record.format}
      AND narration_lang = ${record.narrationLang}
      AND is_current
  `;
  const rows = (await sql`
    INSERT INTO video_renders
      (job_id, project_id, storyboard_id, format, narration_lang, video_url, poster_url, srt_url,
       vtt_url, duration_seconds, width, height, fps, file_size_bytes, render_seconds,
       approval_status, is_current)
    VALUES (${record.jobId}::uuid, ${record.projectId}::uuid, ${record.storyboardId}::uuid,
            ${record.format}, ${record.narrationLang}, ${record.videoUrl}, ${record.posterUrl},
            ${record.srtUrl}, ${record.vttUrl}, ${record.durationSeconds}, ${record.width},
            ${record.height}, ${record.fps}, ${record.fileSizeBytes}, ${record.renderSeconds},
            ${record.approvalStatus}, true)
    RETURNING id
  `) as { id: string }[];
  return rows[0].id;
}

export async function logEvent(params: {
  projectId?: string | null;
  renderJobId?: string | null;
  renderId?: string | null;
  actor: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO video_events (project_id, render_job_id, render_id, actor, event_type, payload)
    VALUES (${params.projectId ?? null}, ${params.renderJobId ?? null}, ${params.renderId ?? null},
            ${params.actor}, ${params.eventType}, ${JSON.stringify(params.payload ?? {})}::jsonb)
  `;
}

/** Resolves the approval mode for a project, most-specific match wins. Mirrors the SQL comment
 * in migration 137 — kept in one place so the worker and the app agree. */
export async function resolveApprovalMode(params: {
  scopeKind: string;
  contentType: string;
  format: string;
  publishTargetKind: string;
}): Promise<"auto" | "script_gate" | "dual_gate"> {
  const rows = (await sql`
    SELECT mode,
           (CASE WHEN scope_kind          <> '*' THEN 1 ELSE 0 END
          + CASE WHEN content_type        <> '*' THEN 1 ELSE 0 END
          + CASE WHEN format              <> '*' THEN 1 ELSE 0 END
          + CASE WHEN publish_target_kind <> '*' THEN 1 ELSE 0 END) AS specificity
    FROM video_policies
    WHERE is_enabled
      AND scope_kind          IN ('*', ${params.scopeKind})
      AND content_type        IN ('*', ${params.contentType})
      AND format              IN ('*', ${params.format})
      AND publish_target_kind IN ('*', ${params.publishTargetKind})
    ORDER BY specificity DESC, priority ASC
    LIMIT 1
  `) as { mode: string }[];
  return (rows[0]?.mode as "auto" | "script_gate" | "dual_gate") ?? "script_gate";
}

export async function getProjectMeta(projectId: string): Promise<{ scopeKind: string; contentType: string }> {
  const rows = (await sql`
    SELECT scope_kind, COALESCE(scope_ref->>'contentType', '*') AS content_type
    FROM video_projects WHERE id = ${projectId}::uuid
  `) as { scope_kind: string; content_type: string }[];
  return { scopeKind: rows[0]?.scope_kind ?? "*", contentType: rows[0]?.content_type ?? "*" };
}
