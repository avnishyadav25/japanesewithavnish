import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getContentAudit } from "@/lib/admin/contentAudit";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const audit = await getContentAudit();
    return NextResponse.json(audit);
  } catch (e) {
    console.error("Content audit:", e);
    return NextResponse.json({ error: "Content audit failed" }, { status: 500 });
  }
}
