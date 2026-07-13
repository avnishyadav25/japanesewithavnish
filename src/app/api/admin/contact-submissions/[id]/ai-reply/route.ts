import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { draftAdminReply } from "@/lib/ai/reply";
import { insertAiLog } from "@/lib/ai-logs";
import { sendAdminReplyEmail } from "@/lib/email";

const FALLBACK_PROMPT =
  'You are a warm, helpful support assistant for Japanese with Avnish, a JLPT-focused Japanese learning platform. Draft a short, friendly reply to the visitor\'s contact form message below. Address their question directly, keep it under 150 words, and sign off as "The Japanese with Avnish Team". Output ONLY the reply body text, no subject line or labels.';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const rows = await sql`
    SELECT id, name, email, message FROM contact_submissions WHERE id = ${id} LIMIT 1
  ` as { id: string; name: string; email: string; message: string }[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await draftAdminReply({
    promptKey: "contact_reply",
    fallbackSystemPrompt: FALLBACK_PROMPT,
    userContext: `Contact message from ${row.name}:\n\n${row.message}`,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });

  await insertAiLog({
    log_type: "contact_reply",
    content_type: "contact",
    entity_type: "contact_submission",
    entity_id: row.id,
    model_used: "deepseek",
    prompt_sent: result.systemPrompt,
    result_preview: result.draft.slice(0, 500),
    admin_email: admin?.email,
  });

  return NextResponse.json({ draft: result.draft });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const replyBody = typeof body.reply === "string" ? body.reply.trim() : "";
  if (!replyBody) return NextResponse.json({ error: "Reply body required" }, { status: 400 });

  const rows = await sql`
    SELECT id, email FROM contact_submissions WHERE id = ${id} LIMIT 1
  ` as { id: string; email: string }[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sendAdminReplyEmail(row.email, "Re: your message — Japanese with Avnish", replyBody);
  await sql`UPDATE contact_submissions SET status = 'replied' WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
