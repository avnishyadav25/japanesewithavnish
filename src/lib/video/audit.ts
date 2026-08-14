/**
 * Video Studio — the audit trail.
 *
 * `video_storyboards` records what a script ENDED UP as. While tuning prompts and pacing the
 * useful question is the other one: what exactly was sent, and what came back? Token counts
 * alone cannot answer "why did that run come out better than this one", so every LLM call is
 * stored verbatim here — including the failures, which are the ones worth keeping.
 *
 * Four concerns, deliberately separate tables (migration 141):
 *   generation runs   every prompt + raw reply, reproducible
 *   drafts            autosave so a refresh does not lose edits
 *   snapshots         the doc at each state change, deduped by checksum
 *   artifacts         which clips and captures a finished render actually consumed
 */
import { createHash } from "crypto";
import { sql } from "@/lib/db";
import type { PacingConfig, Storyboard } from "./types";

function requireSql(): NonNullable<typeof sql> {
  if (!sql) throw new Error("Database unavailable");
  return sql;
}

// ---------------------------------------------------------------------------
// Generation runs
// ---------------------------------------------------------------------------

export interface GenerationRunInput {
  projectId: string;
  storyboardId?: string | null;
  kind?: "full_script" | "scene_regenerate" | "auto_short" | "metadata";
  narrationLang: string;
  model: string;
  promptKey?: string | null;
  systemPrompt: string;
  userMessage: string;
  rawResponse?: string | null;
  slots?: unknown;
  pacing?: PacingConfig | null;
  estimatedSeconds?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  estimatedCostUsd?: number | null;
  status?: "ok" | "parse_failed" | "api_error";
  errorMessage?: string | null;
  durationMs?: number | null;
  requestedBy: string;
}

export async function recordGenerationRun(input: GenerationRunInput): Promise<string> {
  const db = requireSql();
  const rows = (await db`
    INSERT INTO video_generation_runs
      (project_id, storyboard_id, kind, narration_lang, model, prompt_key, system_prompt,
       user_message, raw_response, slots, pacing, estimated_seconds, prompt_tokens,
       completion_tokens, estimated_cost_usd, status, error_message, duration_ms, requested_by)
    VALUES (${input.projectId}::uuid, ${input.storyboardId ?? null}, ${input.kind ?? "full_script"},
            ${input.narrationLang}, ${input.model}, ${input.promptKey ?? null}, ${input.systemPrompt},
            ${input.userMessage}, ${input.rawResponse ?? null},
            ${input.slots ? JSON.stringify(input.slots) : null}::jsonb,
            ${input.pacing ? JSON.stringify(input.pacing) : null}::jsonb,
            ${input.estimatedSeconds ?? null}, ${input.promptTokens ?? null},
            ${input.completionTokens ?? null}, ${input.estimatedCostUsd ?? null},
            ${input.status ?? "ok"}, ${input.errorMessage ?? null}, ${input.durationMs ?? null},
            ${input.requestedBy})
    RETURNING id
  `) as { id: string }[];
  return rows[0].id;
}

export interface GenerationRunRow {
  id: string;
  kind: string;
  narrationLang: string | null;
  model: string;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string | null;
  estimatedSeconds: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUsd: number | null;
  status: string;
  errorMessage: string | null;
  durationMs: number | null;
  requestedBy: string | null;
  createdAt: string;
}

export async function listGenerationRuns(projectId: string, limit = 20): Promise<GenerationRunRow[]> {
  const db = requireSql();
  const rows = (await db`
    SELECT id, kind, narration_lang, model, system_prompt, user_message, raw_response,
           estimated_seconds, prompt_tokens, completion_tokens, estimated_cost_usd, status,
           error_message, duration_ms, requested_by, created_at::text AS created_at
    FROM video_generation_runs
    WHERE project_id = ${projectId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    narrationLang: (row.narration_lang as string | null) ?? null,
    model: String(row.model),
    systemPrompt: String(row.system_prompt),
    userMessage: String(row.user_message),
    rawResponse: (row.raw_response as string | null) ?? null,
    estimatedSeconds: row.estimated_seconds === null ? null : Number(row.estimated_seconds),
    promptTokens: (row.prompt_tokens as number | null) ?? null,
    completionTokens: (row.completion_tokens as number | null) ?? null,
    estimatedCostUsd: row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
    status: String(row.status),
    errorMessage: (row.error_message as string | null) ?? null,
    durationMs: (row.duration_ms as number | null) ?? null,
    requestedBy: (row.requested_by as string | null) ?? null,
    createdAt: String(row.created_at),
  }));
}

// ---------------------------------------------------------------------------
// State snapshots
// ---------------------------------------------------------------------------

export function checksumDoc(doc: Storyboard): string {
  return createHash("sha256").update(JSON.stringify(doc.scenes)).digest("hex");
}

/**
 * Records the document as it stood at a state transition.
 *
 * Deduplicated by checksum: approving, queueing and rendering do not change the doc, so storing
 * a full copy at each would mean five identical 200KB blobs per script. When the checksum
 * already exists for this storyboard the row is written with a NULL doc pointing at the same
 * checksum — the transition is still in the history, the bytes are stored once.
 */
export async function snapshotStoryboardState(params: {
  storyboardId: string;
  projectId?: string | null;
  fromState?: string | null;
  toState: string;
  doc: Storyboard;
  actor: string;
}): Promise<void> {
  const db = requireSql();
  const checksum = checksumDoc(params.doc);

  const existing = (await db`
    SELECT 1 FROM video_storyboard_snapshots
    WHERE storyboard_id = ${params.storyboardId}::uuid AND doc_checksum = ${checksum}
    LIMIT 1
  `) as unknown[];

  await db`
    INSERT INTO video_storyboard_snapshots
      (storyboard_id, project_id, from_state, to_state, doc_checksum, doc, actor)
    VALUES (${params.storyboardId}::uuid, ${params.projectId ?? null}, ${params.fromState ?? null},
            ${params.toState}, ${checksum},
            ${existing.length > 0 ? null : JSON.stringify(params.doc)}::jsonb, ${params.actor})
  `;
}

/** Resolves a snapshot's doc, following the checksum back to the row that actually stored it. */
export async function getSnapshotDoc(snapshotId: string): Promise<Storyboard | null> {
  const db = requireSql();
  const rows = (await db`
    SELECT COALESCE(
             s.doc,
             (SELECT o.doc FROM video_storyboard_snapshots o
              WHERE o.storyboard_id = s.storyboard_id AND o.doc_checksum = s.doc_checksum
                AND o.doc IS NOT NULL
              ORDER BY o.created_at LIMIT 1)
           ) AS doc
    FROM video_storyboard_snapshots s WHERE s.id = ${snapshotId}::uuid
  `) as { doc: Storyboard | null }[];
  return rows[0]?.doc ?? null;
}

// ---------------------------------------------------------------------------
// Editor drafts
// ---------------------------------------------------------------------------

/**
 * Autosave slot. Deliberately not a storyboard version: an autosave every few seconds would
 * leave forty numbered versions behind after one editing session, and "which of these can I
 * render" would stop having an answer.
 */
export async function saveDraft(params: {
  storyboardId: string;
  editorEmail: string;
  doc: Storyboard;
  baseVersion?: number | null;
}): Promise<void> {
  const db = requireSql();
  await db`
    INSERT INTO video_storyboard_drafts (storyboard_id, editor_email, doc, base_version, updated_at)
    VALUES (${params.storyboardId}::uuid, ${params.editorEmail}, ${JSON.stringify(params.doc)}::jsonb,
            ${params.baseVersion ?? null}, NOW())
    ON CONFLICT (storyboard_id, editor_email)
    DO UPDATE SET doc = EXCLUDED.doc, base_version = EXCLUDED.base_version, updated_at = NOW()
  `;
}

export async function getDraft(
  storyboardId: string,
  editorEmail: string
): Promise<{ doc: Storyboard; baseVersion: number | null; updatedAt: string } | null> {
  const db = requireSql();
  const rows = (await db`
    SELECT doc, base_version, updated_at::text AS updated_at
    FROM video_storyboard_drafts
    WHERE storyboard_id = ${storyboardId}::uuid AND editor_email = ${editorEmail}
  `) as { doc: Storyboard; base_version: number | null; updated_at: string }[];
  const row = rows[0];
  return row ? { doc: row.doc, baseVersion: row.base_version, updatedAt: row.updated_at } : null;
}

/** Cleared once the draft has been promoted to a real version, so the editor stops offering to
 * restore work that is already saved. */
export async function clearDraft(storyboardId: string, editorEmail: string): Promise<void> {
  const db = requireSql();
  await db`
    DELETE FROM video_storyboard_drafts
    WHERE storyboard_id = ${storyboardId}::uuid AND editor_email = ${editorEmail}
  `;
}

// ---------------------------------------------------------------------------
// Render artifacts
// ---------------------------------------------------------------------------

export interface ArtifactInput {
  renderId?: string | null;
  jobId?: string | null;
  kind: "tts" | "broll" | "bgm" | "poster" | "captions" | "video";
  sceneId?: string | null;
  segmentId?: string | null;
  assetId?: string | null;
  url?: string | null;
  durationSeconds?: number | null;
  bytes?: number | null;
  fromCache?: boolean;
}

/** Bulk insert — a render consumes dozens of clips and one round-trip each would dominate the
 * upload stage. */
export async function recordArtifacts(artifacts: ArtifactInput[]): Promise<void> {
  if (artifacts.length === 0) return;
  const db = requireSql();
  const values: unknown[] = [];
  const tuples = artifacts.map((a, i) => {
    const base = i * 9;
    values.push(
      a.renderId ?? null,
      a.jobId ?? null,
      a.kind,
      a.sceneId ?? null,
      a.segmentId ?? null,
      a.assetId ?? null,
      a.url ?? null,
      a.durationSeconds ?? null,
      a.bytes ?? null
    );
    return `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::uuid, $${base + 7}, $${base + 8}, $${base + 9})`;
  });

  await db.query(
    `INSERT INTO video_render_artifacts
       (render_id, job_id, kind, scene_id, segment_id, asset_id, url, duration_seconds, bytes)
     VALUES ${tuples.join(", ")}`,
    values
  );
}
