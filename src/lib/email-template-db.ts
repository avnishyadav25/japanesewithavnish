import { sql } from "@/lib/db";

/** Substitutes {{key}} placeholders in a template string with values from `vars`. */
function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

/** Loads an admin-editable email template row (see /admin/emailtemplate) and substitutes
 * {{variable}} placeholders. Returns null if no DB row exists, so callers can fall back to
 * their hardcoded default content/subject. */
export async function renderDbEmailTemplate(
  key: string,
  vars: Record<string, string>
): Promise<{ subject: string; bodyHtml: string } | null> {
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT subject, body_html FROM email_templates WHERE key = ${key} LIMIT 1
    `) as { subject: string; body_html: string }[];
    const row = rows[0];
    if (!row) return null;
    return {
      subject: substitute(row.subject, vars),
      bodyHtml: substitute(row.body_html, vars),
    };
  } catch {
    return null;
  }
}
