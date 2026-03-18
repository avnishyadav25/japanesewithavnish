import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type ScoreboardEntry = {
  rank: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  level: string | null;
  streak: number;
  points: number;
};

type Row = { email: string; display_name: string | null; avatar_url?: string | null; recommended_level: string | null; streak: number; points: number };

function toEntries(rows: Row[]): ScoreboardEntry[] {
  return (rows ?? []).map((r, i) => ({
    rank: i + 1,
    email: r.email,
    displayName: r.display_name?.trim() ? r.display_name : `Learner #${i + 1}`,
    avatarUrl: r.avatar_url?.trim() || null,
    level: r.recommended_level,
    streak: r.streak,
    points: r.points,
  }));
}

/** Public API: top users by streak or by total points. Only users with show_on_scoreboard = true. */
export async function GET(req: NextRequest) {
  if (!sql) {
    return NextResponse.json({ byStreak: [], byPoints: [] });
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10)));
  const type = searchParams.get("type") || "both";

  try {
    let byStreak: ScoreboardEntry[] = [];
    let byPoints: ScoreboardEntry[] = [];

    if (type === "streaks" || type === "both") {
      const rows = await sql`
        SELECT
          p.email,
          p.display_name,
          p.avatar_url,
          p.recommended_level,
          COALESCE(p.current_streak, 0)::int AS streak,
          (SELECT COALESCE(SUM(e.points), 0)::int FROM reward_events e WHERE e.user_email = p.email) AS points
        FROM profiles p
        WHERE p.show_on_scoreboard = TRUE
          AND (COALESCE(p.current_streak, 0) > 0 OR (SELECT COALESCE(SUM(e.points), 0) FROM reward_events e WHERE e.user_email = p.email) > 0)
        ORDER BY streak DESC, points DESC
        LIMIT ${limit}
      ` as Row[];
      byStreak = toEntries(rows ?? []);
    }

    if (type === "points" || type === "both") {
      const rows = await sql`
        SELECT
          p.email,
          p.display_name,
          p.avatar_url,
          p.recommended_level,
          COALESCE(p.current_streak, 0)::int AS streak,
          (SELECT COALESCE(SUM(e.points), 0)::int FROM reward_events e WHERE e.user_email = p.email) AS points
        FROM profiles p
        WHERE p.show_on_scoreboard = TRUE
          AND (COALESCE(p.current_streak, 0) > 0 OR (SELECT COALESCE(SUM(e.points), 0) FROM reward_events e WHERE e.user_email = p.email) > 0)
        ORDER BY points DESC, streak DESC
        LIMIT ${limit}
      ` as Row[];
      byPoints = toEntries(rows ?? []);
    }

    const res = NextResponse.json({
      byStreak: type === "points" ? [] : byStreak,
      byPoints: type === "streaks" ? [] : byPoints,
    });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=120");
    return res;
  } catch (e) {
    console.error("Scoreboard:", e);
    return NextResponse.json({ byStreak: [], byPoints: [] });
  }
}

