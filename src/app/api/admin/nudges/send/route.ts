import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sendNudge } from "@/lib/reengagement";

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!email || !message) return NextResponse.json({ error: "email and message required" }, { status: 400 });

  await sendNudge(email, message);
  return NextResponse.json({ ok: true });
}
