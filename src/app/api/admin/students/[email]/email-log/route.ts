import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { email: rawEmail } = await params;
  const userEmail = decodeURIComponent(rawEmail);

  const rows = await sql`
    SELECT id, sent_by_admin_email, template_key, subject, status, error, sent_at
    FROM admin_email_log
    WHERE user_email = ${userEmail}
    ORDER BY sent_at DESC
    LIMIT 50
  `;
  return NextResponse.json(rows);
}
