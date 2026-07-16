import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const rows = await sql`
    SELECT id, entity_type, entity_id, trigger_type, status, attempt_count, max_attempts,
           error_message, requested_by, created_at, started_at, completed_at
    FROM content_review_jobs WHERE id = ${id}
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job: rows[0] });
}
