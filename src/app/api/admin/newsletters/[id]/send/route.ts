import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { sendNewsletter } from "@/lib/email";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;

  const newsletterRows = await sql`
    SELECT id, subject, body_html, status FROM newsletters WHERE id = ${id} LIMIT 1
  ` as { id: string; subject: string; body_html: string; status: string }[];
  const newsletter = newsletterRows[0];
  if (!newsletter) return NextResponse.json({ error: "Newsletter not found" }, { status: 404 });
  if (newsletter.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 400 });

  const subscriberRows = await sql`SELECT email, name FROM subscribers` as { email: string; name: string | null }[];
  const subscribers = subscriberRows ?? [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const sub of subscribers) {
    try {
      const result = await sendNewsletter(sub.email, sub.name ?? undefined, newsletter.subject, newsletter.body_html);
      const status = result ? "sent" : "skipped";
      if (status === "sent") sent++;
      else skipped++;
      await sql`
        INSERT INTO newsletter_send_logs (newsletter_id, email, status, error, sent_at)
        VALUES (${id}, ${sub.email}, ${status}, ${status === "skipped" ? "Email provider not configured or returned no message id" : null}, NOW())
      `;
    } catch (e) {
      console.error("Newsletter send to", sub.email, e);
      failed++;
      await sql`
        INSERT INTO newsletter_send_logs (newsletter_id, email, status, error, sent_at)
        VALUES (${id}, ${sub.email}, 'failed', ${e instanceof Error ? e.message.slice(0, 500) : "Unknown send error"}, NOW())
      `;
    }
  }

  await sql`
    UPDATE newsletters SET status = 'sent', sent_at = ${new Date().toISOString()}, updated_at = ${new Date().toISOString()} WHERE id = ${id}
  `;
  return NextResponse.json({ ok: true, sent, failed, skipped, total: subscribers.length });
}
