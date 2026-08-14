import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    // 1. Fetch current profile points and freezes
    const profileRows = await sql`
      SELECT points, streak_freezes FROM profiles
      WHERE email = ${session.email} LIMIT 1
    ` as { points: number; streak_freezes: number }[];

    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currentPoints = Number(profile.points ?? 0);
    const currentFreezes = Number(profile.streak_freezes ?? 0);

    // 2. Validate balance (cost is 100 points)
    const cost = 100;
    if (currentPoints < cost) {
      return NextResponse.json(
        { error: `Insufficient points. You need ${cost} points, but you have ${currentPoints}.` },
        { status: 400 }
      );
    }

    const newPoints = currentPoints - cost;
    const newFreezes = currentFreezes + 1;

    // 3. Perform transactional database updates
    await sql`
      UPDATE profiles
      SET points = ${newPoints},
          streak_freezes = ${newFreezes},
          updated_at = NOW()
      WHERE email = ${session.email}
    `;

    // 4. Log spent transaction
    await sql`
      INSERT INTO points_transactions (user_email, type, points, reason)
      VALUES (${session.email}, 'redeemed', ${-cost}, 'Purchased Streak Freeze')
    `;

    return NextResponse.json({
      success: true,
      points: newPoints,
      streakFreezes: newFreezes
    });
  } catch (error) {
    console.error("Streak Freeze Purchase error:", error);
    return NextResponse.json({ error: "Failed to process purchase" }, { status: 500 });
  }
}
