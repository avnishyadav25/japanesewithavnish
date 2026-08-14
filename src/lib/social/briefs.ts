/**
 * Briefs, variants and generation runs — the content half of the social engine.
 *
 * A BRIEF is the thing being promoted (a render, a blog post, a bare topic). A VARIANT is
 * generated copy for one surface in one language. Deliveries live in ./publications.ts.
 *
 * Row shapes are migration 143. snake_case stays at this boundary and nothing above it sees it.
 */
import { sql } from "@/lib/db";
import { BRAND } from "../brand";
import { platformOf, type SocialLang, type SurfaceId } from "./platforms";
import type {
  BriefSourceType,
  ClampViolation,
  SocialBriefFacts,
  SocialBriefRow,
  SocialGenerationRunInput,
  SocialVariantRow,
  SurfaceContent,
  VariantSource,
} from "./types";

function requireSql(): NonNullable<typeof sql> {
  if (!sql) throw new Error("Database unavailable");
  return sql;
}

type Row = Record<string, unknown>;

function toBrief(r: Row): SocialBriefRow {
  return {
    id: String(r.id),
    sourceType: r.source_type as BriefSourceType,
    renderId: (r.render_id as string) ?? null,
    postId: (r.post_id as string) ?? null,
    sourceRef: (r.source_ref as Record<string, unknown>) ?? {},
    legacyPackId: (r.legacy_pack_id as string) ?? null,
    title: String(r.title),
    summary: (r.summary as string) ?? null,
    bodyContext: (r.body_context as string) ?? null,
    jlptLevel: (r.jlpt_level as string) ?? null,
    contentType: (r.content_type as string) ?? null,
    linkPath: (r.link_path as string) ?? null,
    utmCampaign: (r.utm_campaign as string) ?? null,
    status: r.status as SocialBriefRow["status"],
    createdBy: (r.created_by as string) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toVariant(r: Row): SocialVariantRow {
  return {
    id: String(r.id),
    briefId: String(r.brief_id),
    platform: r.platform as SocialVariantRow["platform"],
    surface: r.surface as SurfaceId,
    lang: r.lang as SocialLang,
    version: Number(r.version),
    source: r.source as VariantSource,
    content: (r.content as SurfaceContent) ?? {},
    hashtags: (r.hashtags as string[]) ?? [],
    media: (r.media as SocialVariantRow["media"]) ?? [],
    clampReport: (r.clamp_report as ClampViolation[]) ?? [],
    approvalStatus: r.approval_status as SocialVariantRow["approvalStatus"],
    approvedBy: (r.approved_by as string) ?? null,
    approvedAt: (r.approved_at as string) ?? null,
    generationRunId: (r.generation_run_id as string) ?? null,
    isCurrent: Boolean(r.is_current),
    createdBy: (r.created_by as string) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

export interface CreateBriefInput {
  sourceType: BriefSourceType;
  renderId?: string | null;
  postId?: string | null;
  sourceRef?: Record<string, unknown>;
  title: string;
  summary?: string | null;
  bodyContext?: string | null;
  jlptLevel?: string | null;
  contentType?: string | null;
  linkPath?: string | null;
  utmCampaign?: string | null;
  createdBy?: string | null;
}

export async function createBrief(input: CreateBriefInput): Promise<SocialBriefRow> {
  const db = requireSql();
  const rows = (await db`
    INSERT INTO social_briefs (
      source_type, render_id, post_id, source_ref, title, summary, body_context,
      jlpt_level, content_type, link_path, utm_campaign, created_by
    ) VALUES (
      ${input.sourceType}, ${input.renderId ?? null}, ${input.postId ?? null},
      ${JSON.stringify(input.sourceRef ?? {})}::jsonb, ${input.title}, ${input.summary ?? null},
      ${input.bodyContext ?? null}, ${input.jlptLevel ?? null}, ${input.contentType ?? null},
      ${input.linkPath ?? null}, ${input.utmCampaign ?? null}, ${input.createdBy ?? null}
    )
    RETURNING *
  `) as Row[];
  return toBrief(rows[0]);
}

/**
 * Find-or-create for a render.
 *
 * The "Promote" button must be idempotent: clicking it twice should land on the same workspace,
 * not create a second brief and quietly split the copy for one video across two pages.
 */
export async function briefForRender(renderId: string, actor: string): Promise<SocialBriefRow> {
  const db = requireSql();
  const existing = (await db`
    SELECT * FROM social_briefs WHERE render_id = ${renderId} AND status <> 'archived'
    ORDER BY created_at DESC LIMIT 1
  `) as Row[];
  if (existing.length > 0) return toBrief(existing[0]);

  // Everything the generator needs about the video, resolved once and frozen onto the brief.
  const info = (await db`
    SELECT r.id, r.format, r.narration_lang, r.duration_seconds, r.width, r.height,
           p.title AS project_title, p.scope_kind, p.scope_ref,
           s.content_snapshot
    FROM video_renders r
    JOIN video_projects p ON p.id = r.project_id
    LEFT JOIN video_storyboards s ON s.id = r.storyboard_id
    WHERE r.id = ${renderId}
  `) as Row[];
  if (info.length === 0) throw new Error("Render not found");
  const v = info[0];

  const snapshot = (v.content_snapshot as { items?: { title?: string; kind?: string }[]; jlptLevel?: string } | null) ?? null;
  const items = snapshot?.items ?? [];
  const kind = items[0]?.kind ?? null;
  const level = snapshot?.jlptLevel ?? null;

  // The item list IS the source material: it is what the video actually taught, so captions
  // built from it cannot drift into promoting something the video does not cover.
  const bodyContext = items.length
    ? `The video covers these ${items.length} items:\n${items.map((i, n) => `${n + 1}. ${i.title ?? ""}`).join("\n")}`
    : null;

  const seconds = v.duration_seconds ? Math.round(Number(v.duration_seconds)) : null;
  const mediaSummary = [
    seconds ? `${seconds}s` : null,
    v.format ? String(v.format) : null,
    v.width && v.height ? `${v.width}x${v.height}` : null,
    "burned-in captions",
  ]
    .filter(Boolean)
    .join(", ");

  return createBrief({
    sourceType: "video_render",
    renderId,
    title: String(v.project_title ?? "Untitled video"),
    summary: mediaSummary,
    bodyContext,
    jlptLevel: level,
    contentType: kind,
    linkPath: null,
    utmCampaign: slugCampaign(String(v.project_title ?? "video")),
    createdBy: actor,
  });
}

/** `?utm_campaign=` value, matching the `30day_<slug>` convention in the promo plan doc. */
export function slugCampaign(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug ? `video_${slug}` : "video";
}

export async function getBrief(id: string): Promise<SocialBriefRow | null> {
  const db = requireSql();
  const rows = (await db`SELECT * FROM social_briefs WHERE id = ${id}`) as Row[];
  return rows.length > 0 ? toBrief(rows[0]) : null;
}

export async function listBriefs(limit = 50): Promise<(SocialBriefRow & { variantCount: number; postedCount: number })[]> {
  const db = requireSql();
  const rows = (await db`
    SELECT b.*,
           (SELECT COUNT(*)::int FROM social_variants v WHERE v.brief_id = b.id AND v.is_current) AS variant_count,
           (SELECT COUNT(*)::int FROM social_posts sp
              JOIN social_variants v2 ON v2.id = sp.variant_id
             WHERE v2.brief_id = b.id AND sp.status = 'published') AS posted_count
    FROM social_briefs b
    WHERE b.status <> 'archived'
    ORDER BY b.created_at DESC
    LIMIT ${limit}
  `) as Row[];
  return rows.map((r) => ({ ...toBrief(r), variantCount: Number(r.variant_count), postedCount: Number(r.posted_count) }));
}

export async function setBriefStatus(id: string, status: SocialBriefRow["status"]): Promise<void> {
  const db = requireSql();
  await db`UPDATE social_briefs SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
}

/** The facts handed to the generator, minus the per-platform link (added by factsForSurface). */
export function briefFacts(brief: SocialBriefRow): Omit<SocialBriefFacts, "linkUrl"> & {
  linkPath: string | null;
  utmCampaign: string | null;
} {
  return {
    title: brief.title,
    summary: brief.summary,
    bodyContext: brief.bodyContext,
    jlptLevel: brief.jlptLevel,
    contentType: brief.contentType,
    mediaSummary: brief.summary,
    sourceType: brief.sourceType,
    linkPath: brief.linkPath ?? BRAND.siteUrl,
    utmCampaign: brief.utmCampaign,
  };
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export interface SaveVariantInput {
  briefId: string;
  surface: SurfaceId;
  lang: SocialLang;
  content: SurfaceContent;
  hashtags: string[];
  clampReport: ClampViolation[];
  media?: SocialVariantRow["media"];
  source: VariantSource;
  generationRunId?: string | null;
  createdBy?: string | null;
}

/**
 * Writes a variant as the current one for its (brief, surface, language).
 *
 * Supersedes rather than overwrites: the previous version keeps its row with `is_current=false`,
 * so a regenerate that comes out worse than what it replaced is recoverable. The partial unique
 * index enforces one current row per slot, so the demotion has to happen first.
 */
export async function saveVariant(input: SaveVariantInput): Promise<SocialVariantRow> {
  const db = requireSql();

  const prior = (await db`
    SELECT version FROM social_variants
    WHERE brief_id = ${input.briefId} AND surface = ${input.surface} AND lang = ${input.lang}
    ORDER BY version DESC LIMIT 1
  `) as Row[];
  const nextVersion = prior.length > 0 ? Number(prior[0].version) + 1 : 1;

  await db`
    UPDATE social_variants SET is_current = false, updated_at = NOW()
    WHERE brief_id = ${input.briefId} AND surface = ${input.surface} AND lang = ${input.lang} AND is_current
  `;

  const rows = (await db`
    INSERT INTO social_variants (
      brief_id, platform, surface, lang, version, source, content, hashtags, media,
      clamp_report, generation_run_id, is_current, created_by
    ) VALUES (
      ${input.briefId}, ${platformOf(input.surface)}, ${input.surface}, ${input.lang},
      ${nextVersion}, ${input.source}, ${JSON.stringify(input.content)}::jsonb,
      ${input.hashtags}, ${JSON.stringify(input.media ?? [])}::jsonb,
      ${JSON.stringify(input.clampReport)}::jsonb, ${input.generationRunId ?? null}, true,
      ${input.createdBy ?? null}
    )
    RETURNING *
  `) as Row[];
  return toVariant(rows[0]);
}

export async function listVariants(briefId: string): Promise<SocialVariantRow[]> {
  const db = requireSql();
  const rows = (await db`
    SELECT * FROM social_variants WHERE brief_id = ${briefId} AND is_current
    ORDER BY platform, surface, lang
  `) as Row[];
  return rows.map(toVariant);
}

export async function getVariant(id: string): Promise<SocialVariantRow | null> {
  const db = requireSql();
  const rows = (await db`SELECT * FROM social_variants WHERE id = ${id}`) as Row[];
  return rows.length > 0 ? toVariant(rows[0]) : null;
}

export async function updateVariantContent(
  id: string,
  content: SurfaceContent,
  hashtags: string[],
  clampReport: ClampViolation[],
  actor: string
): Promise<SocialVariantRow> {
  const db = requireSql();
  const rows = (await db`
    UPDATE social_variants
       SET content = ${JSON.stringify(content)}::jsonb,
           hashtags = ${hashtags},
           clamp_report = ${JSON.stringify(clampReport)}::jsonb,
           source = 'human_edited',
           created_by = ${actor},
           updated_at = NOW()
     WHERE id = ${id}
    RETURNING *
  `) as Row[];
  if (rows.length === 0) throw new Error("Variant not found");
  return toVariant(rows[0]);
}

export async function setVariantApproval(
  id: string,
  decision: "approved" | "rejected",
  actor: string
): Promise<void> {
  const db = requireSql();
  await db`
    UPDATE social_variants
       SET approval_status = ${decision}, approved_by = ${actor}, approved_at = NOW(), updated_at = NOW()
     WHERE id = ${id}
  `;
}

// ---------------------------------------------------------------------------
// Generation runs
// ---------------------------------------------------------------------------

/**
 * Records one LLM call verbatim.
 *
 * Including the failures. `video_generation_runs` made the same choice and it is the reason a
 * bad generation is diagnosable at all: token counts alone never answer "why did that run come
 * out better than this one".
 */
export async function recordGenerationRun(input: SocialGenerationRunInput): Promise<string | null> {
  if (!sql) return null;
  try {
    const rows = (await sql`
      INSERT INTO social_generation_runs (
        brief_id, batch_id, variant_ids, kind, surface, langs, model, prompt_key,
        system_prompt, user_message, raw_response, prompt_tokens, completion_tokens,
        estimated_cost_usd, status, error_message, duration_ms, requested_by
      ) VALUES (
        ${input.briefId}, ${input.batchId}, ${input.variantIds ?? null}, ${input.kind},
        ${input.surface}, ${input.langs}, ${input.model}, ${input.promptKey},
        ${input.systemPrompt}, ${input.userMessage}, ${input.rawResponse},
        ${input.promptTokens}, ${input.completionTokens}, ${input.estimatedCostUsd},
        ${input.status}, ${input.errorMessage}, ${input.durationMs}, ${input.requestedBy}
      )
      RETURNING id
    `) as Row[];
    return String(rows[0].id);
  } catch (err) {
    // Never let the audit trail fail the thing it is auditing.
    console.error("[social] failed to record generation run:", err);
    return null;
  }
}

/** Spend over a window, for the daily cap and the cost line in the UI. */
export async function generationSpendUsd(sinceHours = 24): Promise<number> {
  if (!sql) return 0;
  const rows = (await sql`
    SELECT COALESCE(SUM(estimated_cost_usd), 0)::float8 AS total
    FROM social_generation_runs
    WHERE created_at > NOW() - (${sinceHours} || ' hours')::interval
  `) as Row[];
  return Number(rows[0]?.total ?? 0);
}
