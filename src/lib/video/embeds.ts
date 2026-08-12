/**
 * Public-side reads for videos embedded on content pages.
 *
 * Only ever returns rows that are explicitly published to a page (`video_content_links.
 * is_published`) AND still current (`video_renders.is_current`). A superseded render stays in
 * R2 so nothing 404s mid-swap, but it must stop being served the moment a newer one replaces
 * it — otherwise a corrected video keeps showing the version with the mistake in it.
 */
import { sql } from "@/lib/db";
import type { NarrationLang, VideoFormat } from "./types";

export interface EmbeddedVideo {
  renderId: string;
  linkId: string;
  videoUrl: string;
  posterUrl: string | null;
  vttUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  format: VideoFormat;
  narrationLang: NarrationLang;
  placement: "hero" | "inline" | "sidebar" | "footer";
  title: string;
  createdAt: string;
}

const SELECT = `
  SELECT l.id AS link_id, l.placement, r.id AS render_id, r.video_url, r.poster_url, r.vtt_url,
         r.duration_seconds, r.width, r.height, r.format, r.narration_lang,
         p.title, r.created_at::text AS created_at
  FROM video_content_links l
  JOIN video_renders r ON r.id = l.render_id
  JOIN video_projects p ON p.id = r.project_id
  WHERE l.is_published AND r.is_current AND r.approval_status <> 'rejected'`;

function toEmbedded(row: Record<string, unknown>): EmbeddedVideo {
  return {
    renderId: String(row.render_id),
    linkId: String(row.link_id),
    videoUrl: String(row.video_url),
    posterUrl: (row.poster_url as string | null) ?? null,
    vttUrl: (row.vtt_url as string | null) ?? null,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    format: row.format as VideoFormat,
    narrationLang: row.narration_lang as NarrationLang,
    placement: row.placement as EmbeddedVideo["placement"],
    title: String(row.title),
    createdAt: String(row.created_at),
  };
}

export async function getVideosForPost(postId: string): Promise<EmbeddedVideo[]> {
  if (!sql) return [];
  const rows = (await sql.query(`${SELECT} AND l.post_id = $1::uuid ORDER BY l.sort_order, r.created_at DESC`, [
    postId,
  ])) as Record<string, unknown>[];
  return rows.map(toEmbedded);
}

export async function getVideosForLesson(lessonId: string): Promise<EmbeddedVideo[]> {
  if (!sql) return [];
  const rows = (await sql.query(`${SELECT} AND l.lesson_id = $1::uuid ORDER BY l.sort_order, r.created_at DESC`, [
    lessonId,
  ])) as Record<string, unknown>[];
  return rows.map(toEmbedded);
}

/** ISO 8601 duration, which is what schema.org VideoObject requires — "PT1M32S", not "92". */
export function toIso8601Duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}
