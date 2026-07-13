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
