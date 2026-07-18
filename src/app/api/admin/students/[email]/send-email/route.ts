import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { sendMail, renderAdminReplyHtml, renderAdminTemplateEmail } from "@/lib/email";

/**
 * Manual + template-based email sending to a single user, with a shared preview step
 * (action:"preview" renders the exact HTML that action:"send" would send, so what the admin
 * sees is what goes out) — decision #7 of the admin panel overhaul. Every send is logged to
 * admin_email_log regardless of success/failure.
 */
export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { email: rawEmail } = await params;
  const userEmail = decodeURIComponent(rawEmail);

  const body = await req.json();
  const action = body.action === "send" ? "send" : "preview";
  const mode = body.mode === "template" ? "template" : "manual";

  let subject: string;
  let bodyHtml: string;

  if (mode === "template") {
    const templateKey = typeof body.templateKey === "string" ? body.templateKey : "";
    if (!templateKey) return NextResponse.json({ error: "templateKey required" }, { status: 400 });
    const vars = body.vars && typeof body.vars === "object" ? (body.vars as Record<string, string>) : {};
    const rendered = await renderAdminTemplateEmail(templateKey, vars);
    if (!rendered) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    subject = rendered.subject;
    bodyHtml = rendered.bodyHtml;
  } else {
    subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const manualBody = typeof body.body === "string" ? body.body : "";
    if (!subject || !manualBody.trim()) {
      return NextResponse.json({ error: "subject and body required" }, { status: 400 });
    }
    bodyHtml = renderAdminReplyHtml(manualBody);
  }

  if (action === "preview") {
    return NextResponse.json({ subject, bodyHtml });
  }

  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  try {
    await sendMail(userEmail, subject, bodyHtml);
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : "Send failed";
  }

  const rows = await sql`
    INSERT INTO admin_email_log (user_email, sent_by_admin_email, template_key, subject, body_html, status, error)
    VALUES (${userEmail}, ${admin.email}, ${mode === "template" ? body.templateKey : null}, ${subject}, ${bodyHtml}, ${status}, ${error})
    RETURNING id, sent_at
  `;
  const row = (rows as { id: string; sent_at: string }[])[0];

  if (status === "failed") {
    return NextResponse.json({ error: error || "Send failed", logId: row?.id }, { status: 502 });
  }
  return NextResponse.json({ success: true, logId: row?.id, sentAt: row?.sent_at });
}
