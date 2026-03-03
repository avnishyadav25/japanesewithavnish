import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const rows = await sql`
    SELECT id, slug, title, subject, body_html, status, sent_at, created_at, updated_at
    FROM newsletters WHERE id = ${id} LIMIT 1
  ` as { id: string; slug: string; title: string | null; subject: string; body_html: string; status: string; sent_at: string | null; created_at: string; updated_at: string }[];
  const newsletter = rows[0];
  if (!newsletter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(newsletter);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const body = await req.json();
  const slug = String(body.slug ?? "").trim();
  const title = body.title != null ? String(body.title) : null;
  const subject = String(body.subject ?? "").trim();
  const body_html = String(body.body_html ?? "");
  const status = body.status === "sent" ? "sent" : "draft";
  const updatedAt = new Date().toISOString();

  await sql`
    UPDATE newsletters SET
      slug = ${slug},
      title = ${title},
      subject = ${subject},
      body_html = ${body_html},
      status = ${status},
      updated_at = ${updatedAt}
    WHERE id = ${id}
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  await sql`DELETE FROM newsletters WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
