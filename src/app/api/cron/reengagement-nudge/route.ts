import { NextResponse } from "next/server";
import { findEligibleNudgeUsers, draftNudgeMessage, sendNudge } from "@/lib/reengagement";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Call from a cron job (e.g. Vercel cron or external scheduler) with ?key=CRON_SECRET
 * (or the Authorization: Bearer <CRON_SECRET> header Vercel injects automatically).
 * Finds inactive, opted-in, not-recently-nudged users, drafts an AI-personalized
 * re-engagement message referencing their in-progress lesson, and sends it immediately.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && key !== CRON_SECRET && !bearerMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await findEligibleNudgeUsers();
  let sent = 0;
  let failed = 0;
  for (const user of users) {
    const result = await draftNudgeMessage(user);
    if ("error" in result) {
      failed++;
      continue;
    }
    try {
      await sendNudge(user.email, result.draft);
      sent++;
    } catch (e) {
      console.error("Nudge send failed for", user.email, e);
      failed++;
    }
  }

  return NextResponse.json({ eligible: users.length, sent, failed });
}
