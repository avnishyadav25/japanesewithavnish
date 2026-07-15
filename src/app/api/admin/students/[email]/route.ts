import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { createEmailVerificationToken } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

function isMissingVerificationColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42703"
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const email = decodeURIComponent((await params).email);
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  let rows: Record<string, unknown>[] = [];
  try {
    rows = await sql`
      SELECT
        p.email,
        p.recommended_level,
        p.display_name,
        p.first_name,
        p.last_name,
        p.is_active,
        p.last_login_at::text,
        p.avatar_url,
        p.address,
        p.phone,
        p.linkedin_url,
        p.instagram_url,
        p.facebook_url,
        p.twitter_url,
        p.website,
        p.current_streak,
        p.longest_streak,
        p.last_activity_date::text,
        p.created_at::text,
        p.updated_at::text,
        p.role,
        p.premium_until::text,
        p.is_lifetime,
        COALESCE(p.subscription_status, us.status) AS subscription_status,
        us.trial_ends_at::text,
        p.xp,
        p.points,
        COALESCE(p.is_test_user, FALSE) AS is_test_user,
        ua.email_verified_at::text,
        ua.verification_sent_at::text,
        (SELECT COUNT(*)::int FROM user_learning_progress u WHERE u.user_email = p.email AND u.status = 'learned') AS learned_count,
        (SELECT COUNT(*)::int FROM review_schedule r WHERE r.user_email = p.email AND r.next_review_at <= NOW()) AS due_count,
        (SELECT COALESCE(SUM(e.points), 0)::int FROM reward_events e WHERE e.user_email = p.email) AS total_points
      FROM profiles p
      LEFT JOIN user_auth ua ON ua.email = p.email
      LEFT JOIN user_subscriptions us ON us.user_email = p.email AND us.status = 'trialing'
      WHERE p.email = ${email}
      LIMIT 1
    ` as Record<string, unknown>[];
  } catch (e) {
    if (!isMissingVerificationColumnError(e)) throw e;
    rows = await sql`
      SELECT
        p.email,
        p.recommended_level,
        p.display_name,
        p.first_name,
        p.last_name,
        p.is_active,
        p.last_login_at::text,
        p.avatar_url,
        p.address,
        p.phone,
        p.linkedin_url,
        p.instagram_url,
        p.facebook_url,
        p.twitter_url,
        p.website,
        p.current_streak,
        p.longest_streak,
        p.last_activity_date::text,
        p.created_at::text,
        p.updated_at::text,
        p.role,
        p.premium_until::text,
        p.is_lifetime,
        COALESCE(p.subscription_status, us.status) AS subscription_status,
        us.trial_ends_at::text,
        p.xp,
        p.points,
        COALESCE(p.is_test_user, FALSE) AS is_test_user,
        NULL::text AS email_verified_at,
        NULL::text AS verification_sent_at,
        (SELECT COUNT(*)::int FROM user_learning_progress u WHERE u.user_email = p.email AND u.status = 'learned') AS learned_count,
        (SELECT COUNT(*)::int FROM review_schedule r WHERE r.user_email = p.email AND r.next_review_at <= NOW()) AS due_count,
        (SELECT COALESCE(SUM(e.points), 0)::int FROM reward_events e WHERE e.user_email = p.email) AS total_points
      FROM profiles p
      LEFT JOIN user_subscriptions us ON us.user_email = p.email AND us.status = 'trialing'
      WHERE p.email = ${email}
      LIMIT 1
    ` as Record<string, unknown>[];
  }

  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const email = decodeURIComponent((await params).email);
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const first_name = typeof body.first_name === "string" ? body.first_name.trim() || null : undefined;
  const last_name = typeof body.last_name === "string" ? body.last_name.trim() || null : undefined;
  const display_name = typeof body.display_name === "string" ? body.display_name.trim() || null : undefined;
  const is_active = typeof body.is_active === "boolean" ? body.is_active : undefined;
  const recommended_level = typeof body.recommended_level === "string" ? body.recommended_level.trim() || null : undefined;
  const avatar_url = typeof body.avatar_url === "string" ? body.avatar_url.trim() || null : undefined;
  const address = typeof body.address === "string" ? body.address.trim() || null : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const linkedin_url = typeof body.linkedin_url === "string" ? body.linkedin_url.trim() || null : undefined;
  const instagram_url = typeof body.instagram_url === "string" ? body.instagram_url.trim() || null : undefined;
  const facebook_url = typeof body.facebook_url === "string" ? body.facebook_url.trim() || null : undefined;
  const twitter_url = typeof body.twitter_url === "string" ? body.twitter_url.trim() || null : undefined;
  const website = typeof body.website === "string" ? body.website.trim() || null : undefined;
  const role = typeof body.role === "string" ? body.role.trim() : undefined;
  const premium_until = typeof body.premium_until === "string" ? body.premium_until || null : (body.premium_until === null ? null : undefined);
  const is_lifetime = typeof body.is_lifetime === "boolean" ? body.is_lifetime : undefined;
  const xp = typeof body.xp === "number" ? body.xp : undefined;
  const points = typeof body.points === "number" ? body.points : undefined;
  const is_test_user = typeof body.is_test_user === "boolean" ? body.is_test_user : undefined;

  const rows = await sql`
    SELECT first_name, last_name, display_name, is_active, recommended_level, avatar_url, address, phone,
           linkedin_url, instagram_url, facebook_url, twitter_url, website, role, premium_until, is_lifetime, xp, points,
           COALESCE(is_test_user, FALSE) AS is_test_user
    FROM profiles WHERE email = ${email} LIMIT 1
  ` as Record<string, unknown>[];
  const current = rows?.[0];
  if (!current) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  if (body.resend_verification === true) {
    const authRows = await sql`
      SELECT
        ua.email,
        ua.email_verified_at::text,
        p.display_name,
        p.first_name,
        p.last_name
      FROM user_auth ua
      LEFT JOIN profiles p ON p.email = ua.email
      WHERE ua.email = ${email}
      LIMIT 1
    ` as { email: string; email_verified_at: string | null; display_name: string | null; first_name: string | null; last_name: string | null }[];
    const authRow = authRows?.[0];
    if (!authRow) return NextResponse.json({ error: "Auth account not found" }, { status: 404 });
    if (authRow.email_verified_at) return NextResponse.json({ success: true, alreadyVerified: true });

    const token = await createEmailVerificationToken(authRow.email);
    const verifyLink = `${SITE_URL.replace(/\/$/, "")}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const name = authRow.display_name || [authRow.first_name, authRow.last_name].filter(Boolean).join(" ") || null;
    await sendEmailVerificationEmail(authRow.email, verifyLink, name);
    await sql`UPDATE user_auth SET verification_sent_at = NOW(), updated_at = NOW() WHERE email = ${authRow.email}`;
    return NextResponse.json({ success: true, alreadyVerified: false });
  }

  const fn = first_name !== undefined ? first_name : (current.first_name as string | null);
  const ln = last_name !== undefined ? last_name : (current.last_name as string | null);
  const dn = display_name !== undefined ? display_name : (current.display_name as string | null);
  const active = is_active !== undefined ? is_active : (current.is_active as boolean | null);
  const rl = recommended_level !== undefined ? recommended_level : (current.recommended_level as string | null);
  const av = avatar_url !== undefined ? avatar_url : (current.avatar_url as string | null);
  const addr = address !== undefined ? address : (current.address as string | null);
  const ph = phone !== undefined ? phone : (current.phone as string | null);
  const li = linkedin_url !== undefined ? linkedin_url : (current.linkedin_url as string | null);
  const ig = instagram_url !== undefined ? instagram_url : (current.instagram_url as string | null);
  const fb = facebook_url !== undefined ? facebook_url : (current.facebook_url as string | null);
  const tw = twitter_url !== undefined ? twitter_url : (current.twitter_url as string | null);
  const web = website !== undefined ? website : (current.website as string | null);
  const r = role !== undefined ? role : (current.role as string | null);
  const pu = premium_until !== undefined ? premium_until : (current.premium_until as string | null);
  const il = is_lifetime !== undefined ? is_lifetime : (current.is_lifetime as boolean | null);
  const x = xp !== undefined ? xp : (current.xp as number | null);
  const pts = points !== undefined ? points : (current.points as number | null);
  const tu = is_test_user !== undefined ? is_test_user : (current.is_test_user as boolean);

  await sql`
    UPDATE profiles SET
      first_name = ${fn},
      last_name = ${ln},
      display_name = ${dn},
      is_active = ${active},
      recommended_level = ${rl},
      avatar_url = ${av},
      address = ${addr},
      phone = ${ph},
      linkedin_url = ${li},
      instagram_url = ${ig},
      facebook_url = ${fb},
      twitter_url = ${tw},
      website = ${web},
      role = ${r},
      premium_until = ${pu ? new Date(pu).toISOString() : null},
      is_lifetime = ${il},
      xp = ${x},
      points = ${pts},
      is_test_user = ${tu},
      updated_at = NOW()
    WHERE email = ${email}
  `;

  if (body.reset_progress === true) {
    await sql`DELETE FROM user_learning_progress WHERE user_email = ${email}`;
    await sql`DELETE FROM review_schedule WHERE user_email = ${email}`;
    await sql`DELETE FROM xp_transactions WHERE user_email = ${email}`;
    await sql`DELETE FROM points_transactions WHERE user_email = ${email}`;
    await sql`DELETE FROM user_badges WHERE user_email = ${email}`;
    await sql`UPDATE profiles SET xp = 0, points = 0, current_streak = 0, longest_streak = 0 WHERE email = ${email}`;
  }

  if (typeof body.award_badge_slug === "string" && body.award_badge_slug.trim()) {
    const badgeRows = await sql`SELECT id FROM badges WHERE slug = ${body.award_badge_slug.trim()} LIMIT 1` as { id: string }[];
    if (badgeRows[0]) {
      await sql`
        INSERT INTO user_badges (user_email, badge_id, awarded_by_admin_email, reason)
        VALUES (${email}, ${badgeRows[0].id}, ${admin.email}, 'Awarded manually by admin')
        ON CONFLICT (user_email, badge_id) DO NOTHING
      `;
    }
  }

  return NextResponse.json({ success: true });
}
