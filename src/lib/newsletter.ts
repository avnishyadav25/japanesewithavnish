import { sql } from "@/lib/db";
import { sendNewsletter } from "@/lib/email";

/** Sends a draft newsletter to all subscribers and marks it sent. Shared by the manual
 * "Send to subscribers" admin action and the send-scheduled-newsletters cron route. */
export async function sendNewsletterById(id: string) {
  if (!sql) return { error: "Database unavailable" as const };

  const newsletterRows = (await sql`
    SELECT id, subject, body_html, status FROM newsletters WHERE id = ${id} LIMIT 1
  `) as { id: string; subject: string; body_html: string; status: string }[];
  const newsletter = newsletterRows[0];
  if (!newsletter) return { error: "Newsletter not found" as const };
  if (newsletter.status === "sent") return { error: "Already sent" as const };

  const subscriberRows = (await sql`SELECT email, name FROM subscribers`) as {
    email: string;
    name: string | null;
  }[];
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

  return { ok: true as const, sent, failed, skipped, total: subscribers.length };
}

/** Sends a newsletter to a small test audience without marking it "sent" or requiring
 * draft status — reuses the same rendering/send path as sendNewsletterById. Defaults to
 * every profile flagged is_test_user when no explicit recipient list is given. Does not
 * write to newsletter_send_logs (that table's status is constrained to sent/failed/skipped
 * for real sends), so test sends stay out of production delivery reporting. */
export async function sendNewsletterTestById(id: string, recipientEmails?: string[]) {
  if (!sql) return { error: "Database unavailable" as const };

  const newsletterRows = (await sql`
    SELECT id, subject, body_html FROM newsletters WHERE id = ${id} LIMIT 1
  `) as { id: string; subject: string; body_html: string }[];
  const newsletter = newsletterRows[0];
  if (!newsletter) return { error: "Newsletter not found" as const };

  let recipients: { email: string; name: string | null }[];
  if (recipientEmails && recipientEmails.length > 0) {
    recipients = recipientEmails.map((email) => ({ email, name: null }));
  } else {
    const testUserRows = (await sql`
      SELECT email, display_name AS name FROM profiles WHERE is_test_user = TRUE
    `) as { email: string; name: string | null }[];
    recipients = testUserRows ?? [];
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const r of recipients) {
    try {
      const result = await sendNewsletter(r.email, r.name ?? undefined, `[TEST] ${newsletter.subject}`, newsletter.body_html);
      if (result) sent++;
      else skipped++;
    } catch (e) {
      console.error("Newsletter test send to", r.email, e);
      failed++;
    }
  }

  return { ok: true as const, sent, failed, skipped, total: recipients.length };
}
