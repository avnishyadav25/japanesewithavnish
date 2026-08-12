import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { deleteFromR2, r2KeyFromUrl } from "@/lib/r2";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const rows = (await sql`
    UPDATE video_bgm_tracks
    SET is_enabled = COALESCE(${typeof body?.isEnabled === "boolean" ? body.isEnabled : null}, is_enabled),
        default_gain_db = COALESCE(${typeof body?.defaultGainDb === "number" ? body.defaultGainDb : null}, default_gain_db),
        mood = COALESCE(${typeof body?.mood === "string" ? body.mood : null}, mood)
    WHERE id = ${id}::uuid
    RETURNING id
  `) as { id: string }[];

  if (!rows[0]) return NextResponse.json({ error: "Track not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  // A project referencing this track has ON DELETE SET NULL, so deleting would silently strip
  // music from those projects on their next render. Refuse instead and say which ones.
  const inUse = (await sql`
    SELECT COUNT(*)::int AS n FROM video_projects WHERE bgm_track_id = ${id}::uuid
  `) as { n: number }[];
  if ((inUse[0]?.n ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `${inUse[0].n} project${inUse[0].n === 1 ? " uses" : "s use"} this track. Disable it instead — existing videos keep their music and it stops being offered for new ones.`,
      },
      { status: 409 }
    );
  }

  const rows = (await sql`DELETE FROM video_bgm_tracks WHERE id = ${id}::uuid RETURNING audio_url`) as {
    audio_url: string;
  }[];
  if (!rows[0]) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  // Best-effort: an orphaned object in R2 costs fractions of a cent, so a failed delete must not
  // fail the request after the row is already gone.
  const key = r2KeyFromUrl(rows[0].audio_url);
  if (key) await deleteFromR2(key).catch(() => {});

  return NextResponse.json({ ok: true });
}
