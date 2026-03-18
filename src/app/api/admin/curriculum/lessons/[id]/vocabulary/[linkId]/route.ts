import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { linkId } = await params;
  await sql`DELETE FROM curriculum_lesson_vocabulary WHERE id = ${linkId}`;
  return NextResponse.json({ success: true });
}
