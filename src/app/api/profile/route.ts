import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { target_level, onboarding_completed, placement_quiz_completed, quiz_recommended_level } = body;

    // Build conditional updates
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Standard parameter assignment helper
    const addUpdate = (column: string, value: any) => {
      if (value !== undefined) {
        updates.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    };

    addUpdate("target_level", target_level);
    addUpdate("current_level", target_level); // Sync current_level initially
    addUpdate("onboarding_completed", onboarding_completed);
    addUpdate("placement_quiz_completed", placement_quiz_completed);
    addUpdate("quiz_recommended_level", quiz_recommended_level);

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    params.push(session.email);
    const query = `
      UPDATE profiles
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE email = $${paramIndex}
      RETURNING email
    `;

    const resultArr = [query, ...params];
    Object.defineProperty(resultArr, "raw", { value: [query] });
    
    const rows = await sql(resultArr as any);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Profile PATCH error:", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
