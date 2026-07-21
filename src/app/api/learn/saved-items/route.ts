import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** Toggle-style save/bookmark endpoint. No GET counterpart — same rationale as
 * /api/learn/progress/sections: the owning page already queries user_saved_items directly in
 * the same request that loads the rest of the page, so the initial state comes from there. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json();
  const ownerType = body.ownerType === "post" ? "post" : "lesson";
  const ownerId = typeof body.ownerId === "string" ? body.ownerId : null;
  if (!ownerId) return NextResponse.json({ error: "ownerId required" }, { status: 400 });

  await sql`
    INSERT INTO user_saved_items (user_email, owner_type, owner_id)
    VALUES (${session.email}, ${ownerType}, ${ownerId})
    ON CONFLICT (user_email, owner_type, owner_id) DO NOTHING
  `;

  return NextResponse.json({ success: true, saved: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json();
  const ownerType = body.ownerType === "post" ? "post" : "lesson";
  const ownerId = typeof body.ownerId === "string" ? body.ownerId : null;
  if (!ownerId) return NextResponse.json({ error: "ownerId required" }, { status: 400 });

  await sql`
    DELETE FROM user_saved_items
    WHERE user_email = ${session.email} AND owner_type = ${ownerType} AND owner_id = ${ownerId}
  `;

  return NextResponse.json({ success: true, saved: false });
}
