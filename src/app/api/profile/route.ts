import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sql) {
    return NextResponse.json({ profile: null });
  }
  try {
    type ProfileRow = {
      email: string; recommended_level: string | null; display_name: string | null;
      streak_reminder_email_opt_out: boolean | null; show_on_scoreboard?: boolean | null;
      first_name?: string | null; last_name?: string | null; avatar_url?: string | null;
      address?: string | null; phone?: string | null;
      linkedin_url?: string | null; instagram_url?: string | null; facebook_url?: string | null; twitter_url?: string | null; website?: string | null;
      last_login_at?: string | null; created_at: string; updated_at: string;
    };
    let rows: ProfileRow[];
    try {
      rows = await sql`
        SELECT email, recommended_level, display_name, streak_reminder_email_opt_out, show_on_scoreboard,
          first_name, last_name, avatar_url, address, phone, linkedin_url, instagram_url, facebook_url, twitter_url, website, last_login_at,
          created_at, updated_at
        FROM profiles WHERE email = ${session.email} LIMIT 1
      ` as ProfileRow[];
    } catch {
      rows = await sql`
        SELECT email, recommended_level, display_name, streak_reminder_email_opt_out, show_on_scoreboard, created_at, updated_at
        FROM profiles WHERE email = ${session.email} LIMIT 1
      ` as ProfileRow[];
      if (rows[0]) (rows[0] as ProfileRow).show_on_scoreboard = (rows[0] as ProfileRow).show_on_scoreboard ?? false;
    }
    const profile = rows[0] ?? null;
    if (profile && profile.show_on_scoreboard === undefined) profile.show_on_scoreboard = false;
    return NextResponse.json({ profile });
  } catch (e) {
    console.error("Profile fetch:", e);
    return NextResponse.json({ profile: null });
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
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const trim = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);
    const email = session.email;

    const updates: { display_name?: string | null; streak_reminder_email_opt_out?: boolean; show_on_scoreboard?: boolean;
      first_name?: string | null; last_name?: string | null; avatar_url?: string | null; address?: string | null; phone?: string | null;
      linkedin_url?: string | null; instagram_url?: string | null; facebook_url?: string | null; twitter_url?: string | null; website?: string | null;
    } = {};
    if (typeof body.display_name === "string" || body.display_name === null) updates.display_name = body.display_name === "" ? null : trim(body.display_name);
    if (typeof body.streak_reminder_email_opt_out === "boolean") updates.streak_reminder_email_opt_out = body.streak_reminder_email_opt_out;
    if (typeof body.show_on_scoreboard === "boolean") updates.show_on_scoreboard = body.show_on_scoreboard;
    if (body.first_name !== undefined) updates.first_name = trim(body.first_name);
    if (body.last_name !== undefined) updates.last_name = trim(body.last_name);
    if (body.avatar_url !== undefined) updates.avatar_url = trim(body.avatar_url);
    if (body.address !== undefined) updates.address = trim(body.address);
    if (body.phone !== undefined) updates.phone = trim(body.phone);
    if (body.linkedin_url !== undefined) updates.linkedin_url = trim(body.linkedin_url);
    if (body.instagram_url !== undefined) updates.instagram_url = trim(body.instagram_url);
    if (body.facebook_url !== undefined) updates.facebook_url = trim(body.facebook_url);
    if (body.twitter_url !== undefined) updates.twitter_url = trim(body.twitter_url);
    if (body.website !== undefined) updates.website = trim(body.website);

    if (Object.keys(updates).length > 0) {
      let current: Record<string, unknown>[];
      try {
        current = await sql`SELECT first_name, last_name, display_name, streak_reminder_email_opt_out, show_on_scoreboard, avatar_url, address, phone, linkedin_url, instagram_url, facebook_url, twitter_url, website FROM profiles WHERE email = ${email} LIMIT 1` as Record<string, unknown>[];
      } catch {
        current = await sql`SELECT display_name, streak_reminder_email_opt_out, show_on_scoreboard FROM profiles WHERE email = ${email} LIMIT 1` as Record<string, unknown>[];
      }
      const cur = current[0] ?? {};
      const first_name = updates.first_name !== undefined ? updates.first_name : ((cur.first_name as string | null) ?? null);
      const last_name = updates.last_name !== undefined ? updates.last_name : ((cur.last_name as string | null) ?? null);
      const display_name = updates.display_name !== undefined ? updates.display_name : ((cur.display_name as string | null) ?? null);
      const streak_reminder_email_opt_out = updates.streak_reminder_email_opt_out !== undefined ? updates.streak_reminder_email_opt_out : Boolean(cur.streak_reminder_email_opt_out);
      const show_on_scoreboard = updates.show_on_scoreboard !== undefined ? updates.show_on_scoreboard : Boolean(cur.show_on_scoreboard);
      const avatar_url = updates.avatar_url !== undefined ? updates.avatar_url : ((cur.avatar_url as string | null) ?? null);
      const address = updates.address !== undefined ? updates.address : ((cur.address as string | null) ?? null);
      const phone = updates.phone !== undefined ? updates.phone : ((cur.phone as string | null) ?? null);
      const linkedin_url = updates.linkedin_url !== undefined ? updates.linkedin_url : ((cur.linkedin_url as string | null) ?? null);
      const instagram_url = updates.instagram_url !== undefined ? updates.instagram_url : ((cur.instagram_url as string | null) ?? null);
      const facebook_url = updates.facebook_url !== undefined ? updates.facebook_url : ((cur.facebook_url as string | null) ?? null);
      const twitter_url = updates.twitter_url !== undefined ? updates.twitter_url : ((cur.twitter_url as string | null) ?? null);
      const website = updates.website !== undefined ? updates.website : ((cur.website as string | null) ?? null);

      try {
        await sql`
          UPDATE profiles SET
            first_name = ${first_name},
            last_name = ${last_name},
            display_name = ${display_name},
            streak_reminder_email_opt_out = ${streak_reminder_email_opt_out},
            show_on_scoreboard = ${show_on_scoreboard},
            avatar_url = ${avatar_url},
            address = ${address},
            phone = ${phone},
            linkedin_url = ${linkedin_url},
            instagram_url = ${instagram_url},
            facebook_url = ${facebook_url},
            twitter_url = ${twitter_url},
            website = ${website},
            updated_at = NOW()
          WHERE email = ${email}
        `;
      } catch {
        await sql`
          UPDATE profiles SET display_name = ${display_name}, streak_reminder_email_opt_out = ${streak_reminder_email_opt_out}, show_on_scoreboard = ${show_on_scoreboard}, updated_at = NOW()
          WHERE email = ${email}
        `;
      }
    }
    try {
      const getRows = await sql`
        SELECT email, recommended_level, display_name, streak_reminder_email_opt_out, show_on_scoreboard,
          first_name, last_name, avatar_url, address, phone, linkedin_url, instagram_url, facebook_url, twitter_url, website, last_login_at, created_at, updated_at
        FROM profiles WHERE email = ${session.email} LIMIT 1
      ` as Record<string, unknown>[];
      return NextResponse.json({ profile: getRows[0] ?? null });
    } catch {
      const fallback = await sql`SELECT email, recommended_level, display_name, streak_reminder_email_opt_out, show_on_scoreboard, created_at, updated_at FROM profiles WHERE email = ${session.email} LIMIT 1` as Record<string, unknown>[];
      return NextResponse.json({ profile: fallback[0] ?? null });
    }
  } catch (e) {
    console.error("Profile PATCH:", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
