import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const VALID_ROLES = ["student", "premium_student", "admin", "editor", "support"];

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { email, role } = await req.json();
    if (!email || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "email and a valid role are required" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE profiles SET role = ${role}, updated_at = NOW()
      WHERE email = ${email}
      RETURNING email, role
    `;
    if (!(rows as unknown[])?.length) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json((rows as unknown[])[0]);
  } catch (error) {
    console.error("Admin profiles/role PATCH error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
