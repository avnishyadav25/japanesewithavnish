import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "blog";
  const slug = searchParams.get("slug")?.trim();
  if (!slug || !sql) return NextResponse.json({ title: "", description: "", summary: "", link: "" });

  if (type === "blog") {
    const rows = await sql`
      SELECT id, title, summary, seo_description FROM posts WHERE slug = ${slug} LIMIT 1
    ` as { id: string; title: string; summary: string | null; seo_description: string | null }[];
    const row = rows[0];
    if (!row) return NextResponse.json({ title: "", description: "", summary: "", link: "" });
    const summary = row.summary || row.seo_description || "";
    const description = summary;
    return NextResponse.json({ title: row.title, description, summary, link: `/blog/${slug}`, entity_id: row.id });
  }

  if (type === "product") {
    const rows = await sql`
      SELECT id, name, description FROM products WHERE slug = ${slug} LIMIT 1
    ` as { id: string; name: string; description: string | null }[];
    const row = rows[0];
    if (!row) return NextResponse.json({ title: "", description: "", summary: "", link: "" });
    const d = row.description || "";
    return NextResponse.json({ title: row.name, description: d, summary: d.slice(0, 500), link: `/product/${slug}`, entity_id: row.id });
  }

  if (type === "newsletter") {
    const rows = await sql`
      SELECT id, title, subject, body_html FROM newsletters WHERE slug = ${slug} LIMIT 1
    ` as { id: string; title: string | null; subject: string; body_html: string }[];
    const row = rows[0];
    if (!row) return NextResponse.json({ title: "", description: "", summary: "", link: "" });
    const title = row.title || row.subject;
    const description = stripHtml(row.body_html).slice(0, 800);
    return NextResponse.json({ title, description, summary: row.subject, link: "", entity_id: row.id });
  }

  return NextResponse.json({ title: "", description: "", summary: "", link: "" });
}
