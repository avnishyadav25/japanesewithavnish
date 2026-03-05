import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!sql) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await sql`
    SELECT id, name, email, message, status, created_at
    FROM contact_submissions WHERE id = ${id} LIMIT 1
  ` as { id: string; name: string; email: string; message: string; status: string; created_at: string }[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const status = body.status as string;
  if (!["read", "replied"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (!sql) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sql`
    UPDATE contact_submissions SET status = ${status} WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
