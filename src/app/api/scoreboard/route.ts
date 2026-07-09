import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const DEFAULT_LIMIT = 50;
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
  const session = await getSession();

  try {
    let byStreak: ScoreboardEntry[] = [];
    let byPoints: ScoreboardEntry[] = [];
    let myStreakRank: ScoreboardEntry | null = null;
    let myPointsRank: ScoreboardEntry | null = null;

    if (type === "streaks" || type === "both") {
      const rows = await sql`
        SELECT
          p.email,
          p.display_name,
          p.avatar_url,
          p.recommended_level,
          COALESCE(p.current_streak, 0)::int AS streak,
          COALESCE(p.points, 0)::int AS points
        FROM profiles p
        WHERE p.show_on_scoreboard = TRUE
          AND (COALESCE(p.current_streak, 0) > 0 OR COALESCE(p.points, 0) > 0)
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
          COALESCE(p.points, 0)::int AS points
        FROM profiles p
        WHERE p.show_on_scoreboard = TRUE
          AND (COALESCE(p.current_streak, 0) > 0 OR COALESCE(p.points, 0) > 0)
        ORDER BY points DESC, streak DESC
        LIMIT ${limit}
      ` as Row[];
      byPoints = toEntries(rows ?? []);
    }

    if (session?.email) {
      const myRows = await sql`
        SELECT
          p.email,
          p.display_name,
          p.avatar_url,
          p.recommended_level,
          COALESCE(p.current_streak, 0)::int AS streak,
          COALESCE(p.points, 0)::int AS points,
          (
            SELECT COUNT(*)::int + 1
            FROM profiles other
            WHERE other.show_on_scoreboard = TRUE
              AND (COALESCE(other.current_streak, 0), COALESCE(other.points, 0), other.email)
                > (COALESCE(p.current_streak, 0), COALESCE(p.points, 0), p.email)
          ) AS streak_rank,
          (
            SELECT COUNT(*)::int + 1
            FROM profiles other
            WHERE other.show_on_scoreboard = TRUE
              AND (COALESCE(other.points, 0), COALESCE(other.current_streak, 0), other.email)
                > (COALESCE(p.points, 0), COALESCE(p.current_streak, 0), p.email)
          ) AS points_rank
        FROM profiles p
        WHERE p.email = ${session.email}
        LIMIT 1
      ` as (Row & { streak_rank: number; points_rank: number })[];

      const mine = myRows[0];
      if (mine) {
        const base = {
          email: mine.email,
          displayName: mine.display_name?.trim() ? mine.display_name : "You",
          avatarUrl: mine.avatar_url?.trim() || null,
          level: mine.recommended_level,
          streak: mine.streak,
          points: mine.points,
        };
        myStreakRank = { ...base, rank: mine.streak_rank };
        myPointsRank = { ...base, rank: mine.points_rank };
      }
    }

    const res = NextResponse.json({
      byStreak: type === "points" ? [] : byStreak,
      byPoints: type === "streaks" ? [] : byPoints,
      me: {
        byStreak: type === "points" ? null : myStreakRank,
        byPoints: type === "streaks" ? null : myPointsRank,
      },
    });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=120");
    return res;
  } catch (e) {
    console.error("Scoreboard:", e);
    return NextResponse.json({ byStreak: [], byPoints: [] });
  }
}
