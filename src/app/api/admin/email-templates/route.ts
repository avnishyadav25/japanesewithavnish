import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ templates: [] });

  const rows = await sql`SELECT key, subject, body_html, updated_at FROM email_templates ORDER BY key`;
  return NextResponse.json({ templates: rows ?? [] });
}
