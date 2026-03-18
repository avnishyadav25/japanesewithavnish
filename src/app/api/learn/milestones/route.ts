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
      SELECT ad.code, ad.name, ad.description, ad.points, ua.earned_at
      FROM user_achievements ua
      JOIN achievement_definitions ad ON ad.id = ua.achievement_id
      WHERE ua.user_email = ${session.email}
      ORDER BY ua.earned_at DESC
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
