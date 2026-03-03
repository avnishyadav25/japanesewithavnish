import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const rows = await sql`
      SELECT id, slug, title, subject, body_html, status, sent_at, created_at, updated_at
      FROM newsletters ORDER BY created_at DESC
    ` as { id: string; slug: string; title: string | null; subject: string; body_html: string; status: string; sent_at: string | null; created_at: string; updated_at: string }[];
    return NextResponse.json({ newsletters: rows ?? [] });
  } catch (e) {
    console.error("Newsletters list:", e);
    return NextResponse.json({ error: "Failed to list" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim() || `newsletter-${Date.now()}`;
    const title = body.title != null ? String(body.title) : null;
    const subject = String(body.subject ?? "").trim() || "Newsletter";
    const body_html = String(body.body_html ?? "");
    const status = body.status === "sent" ? "sent" : "draft";

    const rows = await sql`
      INSERT INTO newsletters (slug, title, subject, body_html, status, updated_at)
      VALUES (${slug}, ${title}, ${subject}, ${body_html}, ${status}, ${new Date().toISOString()})
      RETURNING id, slug, title, subject, status, created_at
    ` as { id: string; slug: string; title: string | null; subject: string; status: string; created_at: string }[];
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    return NextResponse.json({ id: row.id, slug: row.slug });
  } catch (e) {
    console.error("Newsletter create:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
