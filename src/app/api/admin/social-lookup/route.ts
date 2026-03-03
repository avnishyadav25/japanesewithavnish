import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "blog";
  const slug = searchParams.get("slug")?.trim();
  if (!slug || !sql) return NextResponse.json({ title: "", description: "", link: "" });

  if (type === "blog") {
    const rows = await sql`
      SELECT title, summary, seo_description FROM posts WHERE slug = ${slug} LIMIT 1
    ` as { title: string; summary: string | null; seo_description: string | null }[];
    const row = rows[0];
    if (!row) return NextResponse.json({ title: "", description: "", link: "" });
    const description = row.summary || row.seo_description || "";
    return NextResponse.json({ title: row.title, description, link: `/blog/${slug}` });
  }

  if (type === "product") {
    const rows = await sql`
      SELECT name, description FROM products WHERE slug = ${slug} LIMIT 1
    ` as { name: string; description: string | null }[];
    const row = rows[0];
    if (!row) return NextResponse.json({ title: "", description: "", link: "" });
    return NextResponse.json({ title: row.name, description: row.description || "", link: `/product/${slug}` });
  }

  return NextResponse.json({ title: "", description: "", link: "" });
}
