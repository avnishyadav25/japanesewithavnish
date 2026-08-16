import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

/**
 * B-roll cache listing and cleanup.
 *
 * There was no route at all: the assets page rendered the table server-side and offered no way
 * to delete a stale capture, purge expired rows, or see what any of them actually look like.
 * Entries expire after 14 days and are re-captured on the next render, so deleting is always
 * safe — the worst case is one extra browser launch.
 */
export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const expired = url.searchParams.get("expired") === "true";

  const rows = (await sql`
    SELECT id, source_url, capture_kind, viewport_w, viewport_h, device_scale, selector,
           asset_url, duration_seconds, captured_at::text, expires_at::text,
           expires_at < NOW() AS is_expired
    FROM video_broll_assets
    WHERE (${kind}::text IS NULL OR capture_kind = ${kind})
      AND (${expired} = false OR expires_at < NOW())
    ORDER BY captured_at DESC
    LIMIT 100
  `) as Record<string, unknown>[];

  const totals = (await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE expires_at < NOW())::int AS expired,
           COUNT(*) FILTER (WHERE capture_kind = 'still')::int AS stills,
           COUNT(*) FILTER (WHERE capture_kind <> 'still')::int AS clips,
           -- Recorded on capture; 0 across the board means the capture path is not writing it.
           COALESCE(SUM(duration_seconds), 0)::float AS seconds
    FROM video_broll_assets
  `) as Record<string, unknown>[];

  return NextResponse.json({
    assets: rows.map((r) => ({
      id: String(r.id),
      sourceUrl: String(r.source_url),
      captureKind: String(r.capture_kind),
      width: Number(r.viewport_w),
      height: Number(r.viewport_h),
      deviceScale: r.device_scale === null ? null : Number(r.device_scale),
      selector: (r.selector as string | null) ?? null,
      assetUrl: String(r.asset_url),
      durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
      capturedAt: String(r.captured_at),
      expiresAt: String(r.expires_at),
      isExpired: Boolean(r.is_expired),
    })),
    totals: totals[0]
      ? {
          total: Number(totals[0].total),
          expired: Number(totals[0].expired),
          stills: Number(totals[0].stills),
          clips: Number(totals[0].clips),
          seconds: Number(totals[0].seconds),
        }
      : { total: 0, expired: 0, stills: 0, clips: 0, seconds: 0 },
  });
}

/**
 * Deletes one capture, or every expired one.
 *
 * Only the database row goes. The R2 object is left alone deliberately: an orphaned object costs
 * fractions of a cent, while deleting one still referenced by an in-flight render would break
 * that render — and the capture path is keyed by recipe hash, so a re-capture overwrites it
 * anyway.
 */
export async function DELETE(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const purgeExpired = url.searchParams.get("purge") === "expired";

  if (purgeExpired) {
    const rows = (await sql`DELETE FROM video_broll_assets WHERE expires_at < NOW() RETURNING id`) as { id: string }[];
    return NextResponse.json({
      ok: true,
      deleted: rows.length,
      message: rows.length === 0 ? "Nothing had expired." : `Removed ${rows.length} expired capture(s).`,
    });
  }

  if (!id) return NextResponse.json({ error: "Pass an id, or purge=expired" }, { status: 400 });

  const rows = (await sql`DELETE FROM video_broll_assets WHERE id = ${id}::uuid RETURNING id`) as { id: string }[];
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, deleted: 1, message: "Removed. It re-captures on the next render." });
}
