import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sendNewsletterById } from "@/lib/newsletter";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await sendNewsletterById(id);
  if ("error" in result) {
    const status = result.error === "Newsletter not found" ? 404 : result.error === "Database unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
