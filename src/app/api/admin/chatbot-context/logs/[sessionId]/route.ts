import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

/**
 * GET /api/admin/chatbot-context/logs/[sessionId]
 * Get all messages for one admin chat test session (admin-only).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { sessionId } = await params;
  if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

  const rows = await sql`
    SELECT role, content, created_at
    FROM admin_chat_logs
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  ` as { role: string; content: string; created_at: string }[];

  return NextResponse.json({ messages: rows || [] });
}
