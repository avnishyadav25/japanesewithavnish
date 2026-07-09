import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ badges: [] });
  }

  try {
    // 1. Fetch all system badges
    const allBadges = await sql`
      SELECT id, name, slug, description, emoji, color, category, trigger_type
      FROM badges
      WHERE is_active = TRUE
      ORDER BY category ASC, created_at ASC, name ASC
    ` as {
      id: string;
      name: string;
      slug: string;
      description: string;
      emoji: string | null;
      color: string | null;
      category: string;
      trigger_type: string;
    }[];

    // 2. Fetch badges earned by current user
    const earnedRows = await sql`
      SELECT badge_id, awarded_at::text as awarded_at, reason
      FROM user_badges
      WHERE user_email = ${session.email}
    ` as { badge_id: string; awarded_at: string; reason: string }[];

    const earnedMap = new Map(earnedRows.map(r => [r.badge_id, r]));

    // 3. Map badges with earned state details
    const badges = allBadges.map(b => {
      const earnedInfo = earnedMap.get(b.id);
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        description: b.description,
        category: b.category,
        triggerType: b.trigger_type,
        color: b.color || "#D0021B",
        iconEmoji: b.emoji || "🏆",
        isEarned: !!earnedInfo,
        awardedAt: earnedInfo?.awarded_at ?? null,
        reason: earnedInfo?.reason ?? null,
      };
    });

    return NextResponse.json({ badges });
  } catch (error) {
    console.error("Badges GET error:", error);
    return NextResponse.json({ badges: [] });
  }
}
