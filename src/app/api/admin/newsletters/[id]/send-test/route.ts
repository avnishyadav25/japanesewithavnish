import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sendNewsletterTestById } from "@/lib/newsletter";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const recipientEmails = Array.isArray(body?.recipientEmails)
    ? (body.recipientEmails as unknown[]).filter((e): e is string => typeof e === "string" && e.trim().length > 0)
    : undefined;

  const result = await sendNewsletterTestById(id, recipientEmails);
  if ("error" in result) {
    const status = result.error === "Newsletter not found" ? 404 : result.error === "Database unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
