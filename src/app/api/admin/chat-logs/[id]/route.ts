import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const { flagged, rating } = body;
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    if (typeof flagged === "boolean") {
      await sql`
        UPDATE admin_chat_logs SET flagged = ${flagged} WHERE id = ${id}::uuid
      `;
    }
    if (typeof rating === "number" && rating >= 1 && rating <= 5) {
      await sql`
        UPDATE admin_chat_logs SET rating = ${rating} WHERE id = ${id}::uuid
      `;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Chat log PATCH:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
