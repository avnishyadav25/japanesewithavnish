import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const VALID_CONTENT_TYPES = ["blog", "product", "page", "newsletter"];
const VALID_EVENT_TYPES = ["view", "duration"];

export async function POST(req: NextRequest) {
  try {
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const body = await req.json();
    const content_type = String(body.content_type ?? "").toLowerCase();
    const content_id = String(body.content_id ?? "");
    const event_type = String(body.event_type ?? "view").toLowerCase();
    const duration_seconds = typeof body.duration_seconds === "number" ? Math.round(body.duration_seconds) : null;
    const session_id = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : null;
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;

    if (!content_type || !VALID_CONTENT_TYPES.includes(content_type) || !content_id) {
      return NextResponse.json({ error: "content_type and content_id required" }, { status: 400 });
    }
    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json({ error: "invalid event_type" }, { status: 400 });
    }

    await sql`
      INSERT INTO content_events (content_type, content_id, event_type, duration_seconds, session_id, path, referrer)
      VALUES (${content_type}, ${content_id}, ${event_type}, ${duration_seconds}, ${session_id}, ${path}, ${referrer})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Analytics event:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
