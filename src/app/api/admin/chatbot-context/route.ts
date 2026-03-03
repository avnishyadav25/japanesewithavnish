import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

/**
 * GET /api/admin/chatbot-context
 * Return current stored chatbot context (admin-only).
 */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ content: null, updatedAt: null });

  const rows = await sql`
    SELECT value, updated_at FROM site_settings WHERE key = 'chatbot_context' LIMIT 1
  ` as { value: { content?: string; updatedAt?: string } | null; updated_at: string | null }[];

  const row = rows[0];
  const value = row?.value;
  const content = value && typeof value.content === "string" ? value.content : null;
  const updatedAt = value?.updatedAt ?? row?.updated_at ?? null;

  return NextResponse.json({ content, updatedAt });
}
