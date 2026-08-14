import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!sql) return NextResponse.json({ comments: 0, contact: 0, feedback: 0 });

  try {
    const [commentsRows, contactRows, feedbackRows] = await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM post_comments WHERE is_read = false AND status = 'approved'`,
      sql`SELECT COUNT(*)::int AS c FROM contact_submissions WHERE status = 'new'`,
      sql`SELECT COUNT(*)::int AS c FROM feedback WHERE status = 'new'`,
    ]);
    return NextResponse.json({
      comments: (commentsRows[0] as { c: number })?.c ?? 0,
      contact: (contactRows[0] as { c: number })?.c ?? 0,
      feedback: (feedbackRows[0] as { c: number })?.c ?? 0,
    });
  } catch (e) {
    console.error("Unread counts:", e);
    return NextResponse.json({ comments: 0, contact: 0, feedback: 0 });
  }
}
