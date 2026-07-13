import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { draftNudgeMessage, type EligibleNudgeUser } from "@/lib/reengagement";

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const user = body.user as EligibleNudgeUser;
  if (!user?.email) return NextResponse.json({ error: "user required" }, { status: 400 });

  const result = await draftNudgeMessage(user);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
