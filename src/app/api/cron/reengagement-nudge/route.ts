import { NextResponse } from "next/server";
import { findEligibleNudgeUsers, draftNudgeMessage, sendNudge } from "@/lib/reengagement";

const CRON_SECRET = process.env.CRON_SECRET;

// Netlify functions default to a ~10s timeout; each AI draft call takes a few seconds,
// so processing all eligible users sequentially in one invocation was overrunning that
// and getting killed mid-request (a bare 500 with no JSON body — exactly what was
// observed). Instead, process users one at a time within a safe time budget and stop
// before the timeout, returning cleanly. This self-resumes across invocations: each
// successful send updates last_nudge_sent_at immediately, so unprocessed users simply
// remain eligible for the next scheduled call — no separate progress-tracking needed.
const TIME_BUDGET_MS = 7000;

/**
 * Call from a cron job (e.g. n8n or external scheduler) with ?key=CRON_SECRET
 * (or the Authorization: Bearer <CRON_SECRET> header). Finds inactive, opted-in,
 * not-recently-nudged users, drafts an AI-personalized re-engagement message
 * referencing their in-progress lesson, and sends it immediately — processing as many
 * as fit within a safe time budget per call.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && key !== CRON_SECRET && !bearerMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const users = await findEligibleNudgeUsers();
  let sent = 0;
  let failed = 0;
  let processed = 0;

  for (const user of users) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    processed++;

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

  return NextResponse.json({
    eligible: users.length,
    processed,
    sent,
    failed,
    remaining: users.length - processed,
  });
}
