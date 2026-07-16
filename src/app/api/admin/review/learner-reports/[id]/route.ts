import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { createJob } from "@/lib/contentReview/jobRunner";
import { sendLearnerReportResolvedEmail } from "@/lib/email";
import type { ReviewEntityType } from "@/lib/contentReview/types";

const VALID_STATUSES = ["new", "triaged", "resolved", "dismissed"];

/** PATCH updates status, optionally triggering a review job for the reported content
 * (learner report -> review queue -> run relevant agents -> human review, per the spec's
 * own flow) when triageAndReview: true is passed. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status;
  const triageAndReview = body?.triageAndReview === true;

  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const rows = (await sql`SELECT id, entity_type, entity_id, status, message, reporter_email FROM learner_content_reports WHERE id = ${id}`) as {
    id: string;
    entity_type: string;
    entity_id: string;
    status: string;
    message: string | null;
    reporter_email: string | null;
  }[];
  if (!rows[0]) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const report = rows[0];

  let reviewJobId: string | null = null;
  if (triageAndReview) {
    const created = await createJob({
      entityType: report.entity_type as ReviewEntityType,
      entityId: report.entity_id,
      triggerType: "manual_single",
      requestedBy: admin.email,
    });
    if ("id" in created) reviewJobId = created.id;
    // A 409 (already in progress) is fine here — some review is already running/queued for
    // this content, which is exactly what triaging a learner report is meant to trigger.
  }

  await sql`
    UPDATE learner_content_reports
    SET status = ${status}, review_job_id = COALESCE(${reviewJobId}, review_job_id)
    WHERE id = ${id}
  `;

  // Gap-fix phase 22: notify the learner who reported this (if they gave an email and it
  // wasn't already resolved before this call — avoids re-sending on a repeat/no-op save).
  if (status === "resolved" && report.status !== "resolved" && report.reporter_email) {
    const postRows = (await sql`SELECT title, slug FROM posts WHERE id = ${report.entity_id}`) as { title: string; slug: string }[];
    const post = postRows[0];
    if (post) {
      const contentUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com"}/learn/${report.entity_type}/${post.slug}`;
      try {
        await sendLearnerReportResolvedEmail(report.reporter_email, post.title, contentUrl, report.message ?? "(no message provided)");
      } catch (err) {
        console.error("[learner-reports] resolution email failed (status update still succeeds):", err);
      }
    }
  }

  return NextResponse.json({ success: true, reviewJobId });
}
