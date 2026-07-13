import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { key } = await params;
  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const bodyHtml = typeof body.body_html === "string" ? body.body_html : "";
  if (!subject || !bodyHtml) {
    return NextResponse.json({ error: "subject and body_html required" }, { status: 400 });
  }

  await sql`
    INSERT INTO email_templates (key, subject, body_html, updated_at)
    VALUES (${key}, ${subject}, ${bodyHtml}, ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, updated_at = EXCLUDED.updated_at
  `;

  return NextResponse.json({ success: true });
}
