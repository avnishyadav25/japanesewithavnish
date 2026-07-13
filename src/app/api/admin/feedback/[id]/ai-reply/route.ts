import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { draftAdminReply } from "@/lib/ai/reply";
import { insertAiLog } from "@/lib/ai-logs";
import { sendAdminReplyEmail } from "@/lib/email";

const FALLBACK_PROMPT =
  'You are a friendly product-team member at Japanese with Avnish replying to a piece of user feedback or a suggestion. Thank them genuinely, address their specific point, and keep it under 120 words. Output ONLY the reply body text, no labels.';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const rows = await sql`
    SELECT id, name, email, message FROM feedback WHERE id = ${id} LIMIT 1
  ` as { id: string; name: string | null; email: string | null; message: string }[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await draftAdminReply({
    promptKey: "feedback_reply",
    fallbackSystemPrompt: FALLBACK_PROMPT,
    userContext: `Feedback from ${row.name || "Anonymous"}:\n\n${row.message}`,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });

  await insertAiLog({
    log_type: "feedback_reply",
    content_type: "feedback",
    entity_type: "feedback",
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
    SELECT id, email FROM feedback WHERE id = ${id} LIMIT 1
  ` as { id: string; email: string | null }[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!row.email) return NextResponse.json({ error: "This submission has no email to reply to" }, { status: 400 });

  await sendAdminReplyEmail(row.email, "Re: your feedback — Japanese with Avnish", replyBody);
  await sql`UPDATE feedback SET status = 'replied' WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
