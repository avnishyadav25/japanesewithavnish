import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

/**
 * GET /api/admin/chatbot-context/logs
 * List recent admin chat test sessions (admin-only).
 */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ sessions: [] });

  const limit = 50;
  const rows = await sql`
    SELECT session_id, admin_email,
           MIN(created_at) AS started_at,
           COUNT(*) AS message_count
    FROM admin_chat_logs
    GROUP BY session_id, admin_email
    ORDER BY MIN(created_at) DESC
    LIMIT ${limit}
  ` as { session_id: string; admin_email: string; started_at: string; message_count: string }[];

  const sessions = (rows || []).map((r) => ({
    session_id: r.session_id,
    admin_email: r.admin_email,
    started_at: r.started_at,
    message_count: Number(r.message_count) || 0,
  }));

  return NextResponse.json({ sessions });
}
