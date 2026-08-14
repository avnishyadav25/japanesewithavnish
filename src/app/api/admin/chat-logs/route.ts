import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";

export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ logs: [] });
  const url = new URL(req.url);
  const flaggedOnly = url.searchParams.get("flagged") === "true";
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "30", 10) || 30);
  try {
    const rows = flaggedOnly
      ? await sql`
          SELECT id, session_id, admin_email, role, content, created_at, flagged, rating
          FROM admin_chat_logs WHERE flagged = TRUE ORDER BY created_at DESC LIMIT ${limit}
        `
      : await sql`
          SELECT id, session_id, admin_email, role, content, created_at, flagged, rating
          FROM admin_chat_logs ORDER BY created_at DESC LIMIT ${limit}
        `;
    return NextResponse.json({ logs: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    console.error("Chat logs GET:", e);
    return NextResponse.json({ logs: [] });
  }
}
