import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { findEligibleNudgeUsers } from "@/lib/reengagement";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await findEligibleNudgeUsers();
  return NextResponse.json({ users });
}
