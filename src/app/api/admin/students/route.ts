import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export type StudentRow = {
  email: string;
  recommended_level: string | null;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  learned_count: number;
  due_count: number;
  total_points: number;
};

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

  try {
    const rows = await sql`
      SELECT
        p.email,
        p.recommended_level,
        p.display_name,
        COALESCE(p.current_streak, 0)::int AS current_streak,
        COALESCE(p.longest_streak, 0)::int AS longest_streak,
        p.last_activity_date::text,
        (SELECT COUNT(*)::int FROM user_learning_progress u WHERE u.user_email = p.email AND u.status = 'learned') AS learned_count,
        (SELECT COUNT(*)::int FROM review_schedule r WHERE r.user_email = p.email AND r.next_review_at <= NOW()) AS due_count,
        (SELECT COALESCE(SUM(e.points), 0)::int FROM reward_events e WHERE e.user_email = p.email) AS total_points
      FROM profiles p
      ORDER BY p.last_activity_date DESC NULLS LAST, p.updated_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    ` as StudentRow[];

    const countRows = await sql`SELECT COUNT(*)::int AS c FROM profiles` as { c: number }[];
    const total = countRows?.[0]?.c ?? 0;

    return NextResponse.json({ students: rows ?? [], total });
  } catch (e) {
    console.error("Admin students:", e);
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
  }
}
