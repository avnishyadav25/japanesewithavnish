import { sql } from "@/lib/db";
import { sendAdminReplyEmail } from "@/lib/email";
import crypto from "crypto";

export type RewardMode = "auto_coupon" | "direct_grant" | "manual_review";

type TopUser = { user_email: string; display_name: string | null; xp_total: number };

function previousMonthRange(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  return {
    periodStart: firstOfPrevMonth.toISOString().slice(0, 10),
    periodEnd: lastOfPrevMonth.toISOString().slice(0, 10),
  };
}

async function getRewardMode(): Promise<RewardMode> {
  if (!sql) return "manual_review";
  const rows = (await sql`SELECT value FROM site_settings WHERE key = 'leaderboard_reward_mode' LIMIT 1`) as {
    value: unknown;
  }[];
  const raw = rows?.[0]?.value;
  const mode = typeof raw === "string" ? raw : null;
  if (mode === "auto_coupon" || mode === "direct_grant" || mode === "manual_review") return mode;
  return "manual_review";
}

async function computeMonthlyTop3(periodStart: string, periodEnd: string): Promise<TopUser[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT xt.user_email, p.display_name, SUM(xt.xp_amount)::int AS xp_total
    FROM xp_transactions xt
    LEFT JOIN profiles p ON p.email = xt.user_email
    WHERE xt.created_at::date BETWEEN ${periodStart}::date AND ${periodEnd}::date
    GROUP BY xt.user_email, p.display_name
    HAVING SUM(xt.xp_amount) > 0
    ORDER BY xp_total DESC
    LIMIT 3
  `) as TopUser[];
  return rows ?? [];
}

async function grantAutoCoupon(email: string): Promise<void> {
  if (!sql) return;
  const code = `WINNER-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const rows = (await sql`
    INSERT INTO coupons (code, discount_type, discount_value, max_uses, expires_at)
    VALUES (${code}, 'percent', 100, 1, NOW() + INTERVAL '30 days')
    RETURNING id
  `) as { id: string }[];
  const couponId = rows[0]?.id;
  if (!couponId) return;
  await sendAdminReplyEmail(
    email,
    "You're a top-3 monthly learner — free month unlocked!",
    `Congratulations — you finished in the top 3 on this month's leaderboard! Use code ${code} at checkout for a free month (100% off, single use, expires in 30 days).`
  );
}

async function grantDirectAccess(email: string): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE profiles
    SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + INTERVAL '1 month',
        updated_at = NOW()
    WHERE email = ${email}
  `;
  await sendAdminReplyEmail(
    email,
    "You're a top-3 monthly learner — free month unlocked!",
    "Congratulations — you finished in the top 3 on this month's leaderboard! We've added a free month of premium access to your account."
  );
}

/** Ranks last month's XP leaderboard, records the top 3 in leaderboard_reward_cycles (idempotent —
 * the UNIQUE(period_start, rank) constraint prevents double-processing the same month), and grants
 * the reward according to the admin-configured mode (site_settings.leaderboard_reward_mode). */
export async function runMonthlyLeaderboardReward(): Promise<{ periodStart: string; winners: number }> {
  if (!sql) return { periodStart: "", winners: 0 };
  const { periodStart, periodEnd } = previousMonthRange();

  const alreadyProcessed = (await sql`
    SELECT 1 FROM leaderboard_reward_cycles WHERE period_start = ${periodStart}::date LIMIT 1
  `) as unknown[];
  if (alreadyProcessed.length > 0) {
    return { periodStart, winners: 0 };
  }

  const top3 = await computeMonthlyTop3(periodStart, periodEnd);
  const mode = await getRewardMode();

  for (let i = 0; i < top3.length; i++) {
    const winner = top3[i];
    const rank = i + 1;
    let rewardStatus: "granted" | "manual_review" = "manual_review";

    if (mode === "auto_coupon") {
      await grantAutoCoupon(winner.user_email);
      rewardStatus = "granted";
    } else if (mode === "direct_grant") {
      await grantDirectAccess(winner.user_email);
      rewardStatus = "granted";
    }

    await sql`
      INSERT INTO leaderboard_reward_cycles (period_start, period_end, rank, user_email, xp_total, reward_mode, reward_status, granted_at)
      VALUES (${periodStart}::date, ${periodEnd}::date, ${rank}, ${winner.user_email}, ${winner.xp_total}, ${mode}, ${rewardStatus}, ${rewardStatus === "granted" ? new Date().toISOString() : null})
      ON CONFLICT (period_start, rank) DO NOTHING
    `;
  }

  return { periodStart, winners: top3.length };
}
