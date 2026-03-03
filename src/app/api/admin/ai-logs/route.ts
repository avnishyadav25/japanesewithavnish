import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("contentType") ?? "";
  const entityType = searchParams.get("entityType") ?? "";
  const entityId = searchParams.get("entityId") ?? "";
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  type LogRow = { id: string; log_type: string; content_type: string; entity_type: string | null; entity_id: string | null; model_used: string; prompt_sent: string | null; result_preview: string | null; created_at: string; admin_email: string | null };
  try {
    let rows: LogRow[];
    if (entityType && entityId) {
      rows = await sql`
        SELECT id, log_type, content_type, entity_type, entity_id, model_used, prompt_sent, result_preview, created_at, admin_email
        FROM ai_generation_logs
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as LogRow[];
    } else if (entityType) {
      rows = await sql`
        SELECT id, log_type, content_type, entity_type, entity_id, model_used, prompt_sent, result_preview, created_at, admin_email
        FROM ai_generation_logs
        WHERE entity_type = ${entityType}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as LogRow[];
    } else if (contentType) {
      rows = await sql`
        SELECT id, log_type, content_type, entity_type, entity_id, model_used, prompt_sent, result_preview, created_at, admin_email
        FROM ai_generation_logs
        WHERE content_type = ${contentType}
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as LogRow[];
    } else {
      rows = await sql`
        SELECT id, log_type, content_type, entity_type, entity_id, model_used, prompt_sent, result_preview, created_at, admin_email
        FROM ai_generation_logs
        ORDER BY created_at DESC
        LIMIT ${limit}
      ` as LogRow[];
    }

    return NextResponse.json({ logs: rows ?? [] });
  } catch (e) {
    console.error("AI logs:", e);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
