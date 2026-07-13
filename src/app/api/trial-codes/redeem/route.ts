import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Sign in to redeem a trial code" }, { status: 401 });
  }
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const rows = (await sql`
    SELECT id, trial_days, max_uses, uses_count, expires_at, active
    FROM trial_codes WHERE code = ${code} LIMIT 1
  `) as { id: string; trial_days: number; max_uses: number | null; uses_count: number; expires_at: string | null; active: boolean }[];
  const trialCode = rows[0];
  if (!trialCode || !trialCode.active) {
    return NextResponse.json({ error: "Invalid trial code" }, { status: 400 });
  }
  if (trialCode.expires_at && new Date(trialCode.expires_at) < new Date()) {
    return NextResponse.json({ error: "This trial code has expired" }, { status: 400 });
  }
  if (trialCode.max_uses != null && trialCode.uses_count >= trialCode.max_uses) {
    return NextResponse.json({ error: "This trial code has reached its usage limit" }, { status: 400 });
  }

  const existingRedemption = (await sql`
    SELECT 1 FROM trial_code_redemptions WHERE trial_code_id = ${trialCode.id} AND user_email = ${session.email} LIMIT 1
  `) as unknown[];
  if (existingRedemption.length > 0) {
    return NextResponse.json({ error: "You've already redeemed this code" }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO trial_code_redemptions (trial_code_id, user_email) VALUES (${trialCode.id}, ${session.email})
    `;
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "23505") return NextResponse.json({ error: "You've already redeemed this code" }, { status: 400 });
    throw e;
  }

  await sql`
    UPDATE trial_codes SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = ${trialCode.id}
  `;

  await sql`
    UPDATE profiles
    SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ${trialCode.trial_days} * INTERVAL '1 day',
        subscription_status = 'trialing',
        updated_at = NOW()
    WHERE email = ${session.email}
  `;

  return NextResponse.json({ ok: true, trialDays: trialCode.trial_days });
}
