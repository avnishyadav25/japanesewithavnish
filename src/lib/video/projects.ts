/**
 * App-side Video Studio service layer.
 *
 * Everything the admin routes and server components need, in one place, so the SQL for a
 * concept (what "the current storyboard" means, how a render job is enqueued) exists once.
 * The worker has its own equivalent in scripts/lib/video/db.ts — deliberately duplicated
 * rather than shared, because the worker runs outside Next and cannot use the `sql` proxy.
 */
import { sql } from "@/lib/db";
import type {
  ApprovalMode,
  NarrationLang,
  ProjectStatus,
  ScopeKind,
  ScopeRef,
  Storyboard,
  VideoFormat,
  VideoProjectRow,
  VideoRenderJobRow,
} from "./types";

export class VideoStudioError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "VideoStudioError";
  }
}

function requireSql(): NonNullable<typeof sql> {
  if (!sql) throw new VideoStudioError("Database unavailable", 503);
  return sql;
}

// ---------------------------------------------------------------------------
// Approval policy
// ---------------------------------------------------------------------------

/**
 * Most-specific match wins: score each candidate rule by how many of its four dimensions are
 * concrete rather than the '*' wildcard, break ties on priority. The seeded catch-all
 * guarantees a result, but the fallback here is `script_gate` anyway — if policy resolution
 * ever returns nothing, the safe answer is "a human looks at it", never "publish it".
 */
export async function resolveApprovalMode(params: {
  scopeKind: string;
  contentType: string;
  format: string;
  publishTargetKind: string;
}): Promise<ApprovalMode> {
  const db = requireSql();
  const rows = (await db`
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
  `) as { mode: ApprovalMode }[];
  return rows[0]?.mode ?? "script_gate";
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

function toProjectRow(row: Record<string, unknown>): VideoProjectRow {
  return {
    id: String(row.id),
    title: String(row.title),
    scopeKind: row.scope_kind as ScopeKind,
    scopeRef: (row.scope_ref ?? {}) as ScopeRef,
    grouping: row.grouping as "single_video" | "video_per_item",
    themeKey: String(row.theme_key),
    bgmTrackId: (row.bgm_track_id as string | null) ?? null,
    narrationLangs: (row.narration_langs ?? ["en"]) as NarrationLang[],
    formats: (row.formats ?? ["vertical"]) as VideoFormat[],
    targetDurationSeconds: (row.target_duration_seconds as number | null) ?? null,
    tone: (row.tone as string | null) ?? null,
    includeBroll: Boolean(row.include_broll),
    status: row.status as ProjectStatus,
    currentStoryboardId: (row.current_storyboard_id as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const PROJECT_COLUMNS = `id, title, scope_kind, scope_ref, grouping, theme_key, bgm_track_id,
  narration_langs, formats, target_duration_seconds, tone, include_broll, status,
  current_storyboard_id, error_message, created_by, created_at::text, updated_at::text`;

export interface CreateProjectInput {
  title: string;
  scopeKind: ScopeKind;
  scopeRef: ScopeRef;
  grouping: "single_video" | "video_per_item";
  themeKey: string;
  bgmTrackId?: string | null;
  narrationLangs: NarrationLang[];
  formats: VideoFormat[];
  targetDurationSeconds?: number | null;
  tone?: string | null;
  includeBroll?: boolean;
  createdBy: string;
}

export async function createProject(input: CreateProjectInput): Promise<VideoProjectRow> {
  const db = requireSql();
  // db.query rather than a tagged template: a tagged template interpolates every `${}` as a
  // bound parameter, so the shared PROJECT_COLUMNS list cannot be spliced into RETURNING.
  const rows = (await db.query(
    `INSERT INTO video_projects
       (title, scope_kind, scope_ref, grouping, theme_key, bgm_track_id, narration_langs, formats,
        target_duration_seconds, tone, include_broll, created_by)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::text[], $8::text[], $9, $10, $11, $12)
     RETURNING ${PROJECT_COLUMNS}`,
    [
      input.title,
      input.scopeKind,
      JSON.stringify(input.scopeRef),
      input.grouping,
      input.themeKey,
      input.bgmTrackId ?? null,
      input.narrationLangs,
      input.formats,
      input.targetDurationSeconds ?? null,
      input.tone ?? null,
      input.includeBroll ?? false,
      input.createdBy,
    ]
  )) as Record<string, unknown>[];
  return toProjectRow(rows[0]);
}

export async function getProject(id: string): Promise<VideoProjectRow | null> {
  const db = requireSql();
  const rows = (await db.query(`SELECT ${PROJECT_COLUMNS} FROM video_projects WHERE id = $1::uuid`, [
    id,
  ])) as Record<string, unknown>[];
  return rows[0] ? toProjectRow(rows[0]) : null;
}

export async function listProjects(filters: { status?: string; limit?: number } = {}): Promise<VideoProjectRow[]> {
  const db = requireSql();
  const values: unknown[] = [];
  let where = "";
  if (filters.status) {
    values.push(filters.status);
    where = `WHERE status = $${values.length}`;
  }
  values.push(filters.limit ?? 50);
  const rows = (await db.query(
    `SELECT ${PROJECT_COLUMNS} FROM video_projects ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
    values
  )) as Record<string, unknown>[];
  return rows.map(toProjectRow);
}

export async function setProjectStatus(id: string, status: ProjectStatus, errorMessage?: string | null): Promise<void> {
  const db = requireSql();
  await db`
    UPDATE video_projects
    SET status = ${status}, error_message = ${errorMessage ?? null}, updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
}

// ---------------------------------------------------------------------------
// Storyboards
// ---------------------------------------------------------------------------

export interface StoryboardRow {
  id: string;
  projectId: string;
  version: number;
  narrationLang: NarrationLang;
  source: string;
  doc: Storyboard;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  llmModel: string | null;
  estimatedCostUsd: number | null;
  createdBy: string | null;
  createdAt: string;
}

const STORYBOARD_COLUMNS = `id, project_id, version, narration_lang, source, doc, approval_status,
  approved_by, approved_at::text, llm_model, estimated_cost_usd, created_by, created_at::text`;

function toStoryboardRow(row: Record<string, unknown>): StoryboardRow {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    version: Number(row.version),
    narrationLang: row.narration_lang as NarrationLang,
    source: String(row.source),
    doc: row.doc as Storyboard,
    approvalStatus: String(row.approval_status),
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    llmModel: (row.llm_model as string | null) ?? null,
    estimatedCostUsd: row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function getStoryboard(id: string): Promise<StoryboardRow | null> {
  const db = requireSql();
  const rows = (await db.query(`SELECT ${STORYBOARD_COLUMNS} FROM video_storyboards WHERE id = $1::uuid`, [
    id,
  ])) as Record<string, unknown>[];
  return rows[0] ? toStoryboardRow(rows[0]) : null;
}

export async function listStoryboards(projectId: string): Promise<StoryboardRow[]> {
  const db = requireSql();
  const rows = (await db.query(
    `SELECT ${STORYBOARD_COLUMNS} FROM video_storyboards WHERE project_id = $1::uuid
     ORDER BY narration_lang, version DESC`,
    [projectId]
  )) as Record<string, unknown>[];
  return rows.map(toStoryboardRow);
}

export interface InsertStoryboardInput {
  projectId: string;
  narrationLang: NarrationLang;
  source: "ai_generated" | "human_edited" | "regenerated" | "imported";
  doc: Storyboard;
  parentStoryboardId?: string | null;
  contentSnapshot?: unknown;
  contentChecksum?: string | null;
  approvalStatus: "draft" | "pending_review" | "approved";
  llmModel?: string | null;
  promptKey?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  estimatedCostUsd?: number | null;
  createdBy: string;
}

/**
 * Inserts a new version rather than updating in place — every edit and every regeneration is
 * a new row, so an approved script that produced a published video is never mutated out from
 * under it. The version number is computed in the INSERT to stay race-free under two admins
 * saving at once; the UNIQUE (project_id, narration_lang, version) index is the backstop.
 */
export async function insertStoryboardVersion(input: InsertStoryboardInput): Promise<StoryboardRow> {
  const db = requireSql();
  const rows = (await db.query(
    `INSERT INTO video_storyboards
       (project_id, version, narration_lang, parent_storyboard_id, source, doc, content_snapshot,
        content_checksum, approval_status, llm_model, prompt_key, prompt_tokens, completion_tokens,
        estimated_cost_usd, created_by)
     VALUES ($1::uuid,
             (SELECT COALESCE(MAX(version), 0) + 1 FROM video_storyboards
               WHERE project_id = $1::uuid AND narration_lang = $2),
             $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING ${STORYBOARD_COLUMNS}`,
    [
      input.projectId,
      input.narrationLang,
      input.parentStoryboardId ?? null,
      input.source,
      JSON.stringify(input.doc),
      input.contentSnapshot ? JSON.stringify(input.contentSnapshot) : null,
      input.contentChecksum ?? null,
      input.approvalStatus,
      input.llmModel ?? null,
      input.promptKey ?? null,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.estimatedCostUsd ?? null,
      input.createdBy,
    ]
  )) as Record<string, unknown>[];

  const inserted = toStoryboardRow(rows[0]);
  // Older versions for this language stop being candidates for rendering.
  await db`
    UPDATE video_storyboards SET approval_status = 'superseded'
    WHERE project_id = ${input.projectId}::uuid
      AND narration_lang = ${input.narrationLang}
      AND id <> ${inserted.id}::uuid
      AND approval_status IN ('draft', 'pending_review')
  `;
  await db`
    UPDATE video_projects SET current_storyboard_id = ${inserted.id}::uuid, updated_at = NOW()
    WHERE id = ${input.projectId}::uuid
  `;
  return inserted;
}

export async function setStoryboardApproval(
  id: string,
  approvalStatus: "approved" | "rejected" | "pending_review",
  actor: string,
  rejectionReason?: string | null
): Promise<void> {
  const db = requireSql();
  await db`
    UPDATE video_storyboards
    SET approval_status = ${approvalStatus},
        approved_by = ${approvalStatus === "approved" ? actor : null},
        approved_at = ${approvalStatus === "approved" ? new Date().toISOString() : null},
        rejection_reason = ${rejectionReason ?? null}
    WHERE id = ${id}::uuid
  `;
}

// ---------------------------------------------------------------------------
// Render jobs
// ---------------------------------------------------------------------------

const JOB_COLUMNS = `id, project_id, storyboard_id, format, status, stage, progress_pct, log,
  runner, runner_id, attempt_count, max_attempts, error_message, requested_by,
  created_at::text, started_at::text, completed_at::text, heartbeat_at::text`;

function toJobRow(row: Record<string, unknown>): VideoRenderJobRow {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    storyboardId: String(row.storyboard_id),
    format: row.format as VideoFormat,
    status: row.status as VideoRenderJobRow["status"],
    stage: (row.stage as VideoRenderJobRow["stage"]) ?? null,
    progressPct: Number(row.progress_pct ?? 0),
    log: (row.log ?? []) as { at: string; message: string }[],
    runner: (row.runner as string | null) ?? null,
    runnerId: (row.runner_id as string | null) ?? null,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    errorMessage: (row.error_message as string | null) ?? null,
    requestedBy: (row.requested_by as string | null) ?? null,
    createdAt: String(row.created_at),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    heartbeatAt: (row.heartbeat_at as string | null) ?? null,
  };
}

/** Enqueues one job per format. The partial unique index on (storyboard_id, format) for
 * in-flight rows makes a double-click a no-op rather than a duplicate render, so the conflict
 * is swallowed and reported as "already queued" instead of surfacing as a 500. */
export async function enqueueRenderJobs(params: {
  projectId: string;
  storyboardId: string;
  formats: VideoFormat[];
  requestedBy: string;
  priority?: number;
}): Promise<{ queued: VideoFormat[]; skipped: VideoFormat[] }> {
  const db = requireSql();
  const queued: VideoFormat[] = [];
  const skipped: VideoFormat[] = [];

  for (const format of params.formats) {
    const rows = (await db`
      INSERT INTO video_render_jobs (project_id, storyboard_id, format, requested_by, priority)
      SELECT ${params.projectId}::uuid, ${params.storyboardId}::uuid, ${format},
             ${params.requestedBy}, ${params.priority ?? 100}
      WHERE NOT EXISTS (
        SELECT 1 FROM video_render_jobs
        WHERE storyboard_id = ${params.storyboardId}::uuid AND format = ${format}
          AND status IN ('queued', 'claimed', 'running')
      )
      RETURNING id
    `) as { id: string }[];
    if (rows[0]) queued.push(format);
    else skipped.push(format);
  }

  return { queued, skipped };
}

export async function listJobs(filters: { projectId?: string; active?: boolean; limit?: number } = {}): Promise<VideoRenderJobRow[]> {
  const db = requireSql();
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.projectId) {
    values.push(filters.projectId);
    clauses.push(`project_id = $${values.length}::uuid`);
  }
  if (filters.active) clauses.push(`status IN ('queued', 'claimed', 'running')`);
  values.push(filters.limit ?? 50);

  const rows = (await db.query(
    `SELECT ${JOB_COLUMNS} FROM video_render_jobs
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY created_at DESC LIMIT $${values.length}`,
    values
  )) as Record<string, unknown>[];
  return rows.map(toJobRow);
}

/** Only a queued job can be cancelled. Once claimed it is mid-flight in some worker process
 * and this queue has no interrupt — the worker polls `isCancelled` between stages, so a
 * running job is marked and stops at the next boundary rather than being killed. */
export async function cancelJob(jobId: string): Promise<{ ok: boolean; message: string }> {
  const db = requireSql();
  const rows = (await db`
    UPDATE video_render_jobs
    SET status = 'cancelled', completed_at = NOW()
    WHERE id = ${jobId}::uuid AND status IN ('queued', 'claimed', 'running')
    RETURNING status
  `) as { status: string }[];
  if (!rows[0]) return { ok: false, message: "Job is not in a cancellable state." };
  return { ok: true, message: "Cancelled. A running job stops at its next stage boundary." };
}

export async function retryJob(jobId: string): Promise<{ ok: boolean; message: string }> {
  const db = requireSql();
  const rows = (await db`
    UPDATE video_render_jobs
    SET status = 'queued', attempt_count = 0, error_message = NULL, stage = NULL,
        progress_pct = 0, claimed_at = NULL, heartbeat_at = NULL, completed_at = NULL
    WHERE id = ${jobId}::uuid AND status IN ('failed', 'cancelled')
    RETURNING id
  `) as { id: string }[];
  if (!rows[0]) return { ok: false, message: "Only a failed or cancelled job can be retried." };
  return { ok: true, message: "Requeued." };
}

// ---------------------------------------------------------------------------
// Renders
// ---------------------------------------------------------------------------

export interface RenderRow {
  id: string;
  projectId: string;
  storyboardId: string;
  format: VideoFormat;
  narrationLang: NarrationLang;
  videoUrl: string;
  posterUrl: string | null;
  srtUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  renderSeconds: number | null;
  approvalStatus: string;
  isCurrent: boolean;
  createdAt: string;
}

export async function listRenders(filters: { projectId?: string; limit?: number } = {}): Promise<RenderRow[]> {
  const db = requireSql();
  const values: unknown[] = [];
  let where = "";
  if (filters.projectId) {
    values.push(filters.projectId);
    where = `WHERE project_id = $${values.length}::uuid`;
  }
  values.push(filters.limit ?? 50);
  const rows = (await db.query(
    `SELECT id, project_id, storyboard_id, format, narration_lang, video_url, poster_url, srt_url,
            duration_seconds, width, height, file_size_bytes, render_seconds, approval_status,
            is_current, created_at::text
     FROM video_renders ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
    values
  )) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    storyboardId: String(row.storyboard_id),
    format: row.format as VideoFormat,
    narrationLang: row.narration_lang as NarrationLang,
    videoUrl: String(row.video_url),
    posterUrl: (row.poster_url as string | null) ?? null,
    srtUrl: (row.srt_url as string | null) ?? null,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    fileSizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes),
    renderSeconds: row.render_seconds === null ? null : Number(row.render_seconds),
    approvalStatus: String(row.approval_status),
    isCurrent: Boolean(row.is_current),
    createdAt: String(row.created_at),
  }));
}

export async function logEvent(params: {
  projectId?: string | null;
  storyboardId?: string | null;
  renderJobId?: string | null;
  renderId?: string | null;
  actor: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const db = requireSql();
  await db`
    INSERT INTO video_events (project_id, storyboard_id, render_job_id, render_id, actor, event_type, payload)
    VALUES (${params.projectId ?? null}, ${params.storyboardId ?? null}, ${params.renderJobId ?? null},
            ${params.renderId ?? null}, ${params.actor}, ${params.eventType},
            ${JSON.stringify(params.payload ?? {})}::jsonb)
  `;
}

// ---------------------------------------------------------------------------
// Themes + BGM (for the wizard)
// ---------------------------------------------------------------------------

export async function listThemes(): Promise<{ key: string; label: string; description: string | null }[]> {
  const db = requireSql();
  return (await db`
    SELECT key, label, description FROM video_themes WHERE is_enabled ORDER BY sort_order, label
  `) as { key: string; label: string; description: string | null }[];
}

export async function listBgmTracks(): Promise<{ id: string; title: string; mood: string | null }[]> {
  const db = requireSql();
  return (await db`
    SELECT id, title, mood FROM video_bgm_tracks WHERE is_enabled ORDER BY title
  `) as { id: string; title: string; mood: string | null }[];
}
