import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** GET /api/learn/milestones — user's earned achievements. */
export async function GET() {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ milestones: [] });
  try {
    const rows = await sql`
      SELECT b.slug as code, b.name, b.description, b.points_reward as points, ub.awarded_at::text as earned_at
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_email = ${session.email}
      ORDER BY ub.awarded_at DESC
    ` as { code: string; name: string; description: string | null; points: number; earned_at: string }[];
    const milestones = (rows ?? []).map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      points: r.points,
      earnedAt: r.earned_at,
    }));
    return NextResponse.json({ milestones });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ milestones: [] });
  }
}
