import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { logEvent } from "@/lib/video/projects";
import { DEFAULT_CAPTIONS, type CaptionSettings } from "@/lib/video/types";

const POSITIONS = new Set(["bottom", "lower-third", "top"]);
const STYLES = new Set(["bold-center", "lower-third"]);

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Saves caption style for a project.
 *
 * Clamped rather than rejected: these come from sliders, and the useful response to a scale of 9
 * is 1.4, not an error. The bounds are the range the layout survives — below 0.6 a burned-in
 * caption is unreadable on a phone, above 1.4 it covers the content this exists to stop covering.
 *
 * Does NOT touch storyboards. Caption style is read at render time from this column, so saving
 * here plus a re-cut is the whole loop — no regeneration, no LLM call, no TTS spend.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const incoming = (body?.captions ?? body) as Partial<CaptionSettings>;

  const captions: Required<CaptionSettings> = {
    enabled: incoming.enabled !== false,
    burnIn: incoming.burnIn !== false,
    style: STYLES.has(String(incoming.style)) ? (incoming.style as CaptionSettings["style"]) : DEFAULT_CAPTIONS.style,
    scale: clamp(Number(incoming.scale) || DEFAULT_CAPTIONS.scale, 0.6, 1.4),
    position: POSITIONS.has(String(incoming.position))
      ? (incoming.position as NonNullable<CaptionSettings["position"]>)
      : DEFAULT_CAPTIONS.position,
    opacity: clamp(Number.isFinite(Number(incoming.opacity)) ? Number(incoming.opacity) : DEFAULT_CAPTIONS.opacity, 0, 1),
    maxWidthPct: clamp(Number(incoming.maxWidthPct) || DEFAULT_CAPTIONS.maxWidthPct, 40, 100),
    // Word-by-word highlighting. Like every other field here it is a render-time setting, so
    // turning it on is a re-cut rather than a regenerate — the timings already sit in the
    // storyboard's audio clips whether or not anything draws them.
    mode: incoming.mode === "word" ? "word" : DEFAULT_CAPTIONS.mode,
  };

  const rows = (await sql`
    UPDATE video_projects SET captions = ${JSON.stringify(captions)}::jsonb, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id
  `) as { id: string }[];
  if (rows.length === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await logEvent({ projectId: id, actor: admin.email, eventType: "captions_updated", payload: captions });

  return NextResponse.json({
    ok: true,
    captions,
    message: "Saved. Re-cut a render to see it in the finished video.",
  });
}
