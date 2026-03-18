import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** GET /api/learn/listening/scenarios — list all scenarios (public for now). */
export async function GET() {
  if (!sql) return NextResponse.json({ scenarios: [] });
  try {
    const rows = await sql`
      SELECT id, listening_id, title, audio_url, transcript, sort_order
      FROM listening_scenarios
      ORDER BY sort_order, title
    ` as { id: string; listening_id: string | null; title: string; audio_url: string; transcript: string | null; sort_order: number }[];
    return NextResponse.json({
      scenarios: rows.map((r) => ({
        id: r.id,
        listeningId: r.listening_id,
        title: r.title,
        audioUrl: r.audio_url,
        transcript: r.transcript,
        sortOrder: r.sort_order,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list scenarios", scenarios: [] }, { status: 500 });
  }
}
