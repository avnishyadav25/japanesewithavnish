import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const rows = (await sql`
    SELECT lesson_id,
      COUNT(*) FILTER (WHERE review_status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
      COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected,
      COUNT(*) FILTER (WHERE status = 'draft') AS draft,
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) AS total
    FROM lesson_blocks
    GROUP BY lesson_id
  `) as {
    lesson_id: string; pending: string; approved: string; rejected: string;
    draft: string; published: string; total: string;
  }[];

  const map: Record<string, { pending: number; approved: number; rejected: number; draft: number; published: number; total: number }> = {};
  for (const r of rows) {
    map[r.lesson_id] = {
      pending: Number(r.pending),
      approved: Number(r.approved),
      rejected: Number(r.rejected),
      draft: Number(r.draft),
      published: Number(r.published),
      total: Number(r.total),
    };
  }
  return NextResponse.json(map);
}
