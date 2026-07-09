import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const rows = await sql`
      SELECT
        email,
        recommended_level,
        current_level,
        target_level,
        display_name,
        first_name,
        last_name,
        avatar_url,
        address,
        phone,
        linkedin_url,
        instagram_url,
        facebook_url,
        twitter_url,
        website,
        show_on_scoreboard,
        streak_reminder_email_opt_out,
        premium_until::text,
        is_lifetime,
        subscription_status,
        last_login_at::text
      FROM profiles
      WHERE email = ${session.email}
      LIMIT 1
    `;

    const profile = rows?.[0] ?? null;
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (e) {
    console.error("Profile GET error:", e);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

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
    const {
      target_level,
      onboarding_completed,
      placement_quiz_completed,
      quiz_recommended_level,
      first_name,
      last_name,
      display_name,
      avatar_url,
      address,
      phone,
      website,
      linkedin_url,
      instagram_url,
      facebook_url,
      twitter_url,
      show_on_scoreboard,
      streak_reminder_email_opt_out,
    } = body;

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
    addUpdate("first_name", first_name);
    addUpdate("last_name", last_name);
    addUpdate("display_name", display_name);
    addUpdate("avatar_url", avatar_url);
    addUpdate("address", address);
    addUpdate("phone", phone);
    addUpdate("website", website);
    addUpdate("linkedin_url", linkedin_url);
    addUpdate("instagram_url", instagram_url);
    addUpdate("facebook_url", facebook_url);
    addUpdate("twitter_url", twitter_url);
    addUpdate("show_on_scoreboard", show_on_scoreboard);
    addUpdate("streak_reminder_email_opt_out", streak_reminder_email_opt_out);

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    params.push(session.email);
    const query = `
      UPDATE profiles
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE email = $${paramIndex}
      RETURNING *
    `;

    const resultArr = [query, ...params];
    Object.defineProperty(resultArr, "raw", { value: [query] });
    
    const rows = await sql(resultArr as any);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: rows[0] });
  } catch (e) {
    console.error("Profile PATCH error:", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
