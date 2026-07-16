import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { isReviewEntityType } from "@/lib/contentReview/types";

export async function PATCH(req: Request, { params }: { params: Promise<{ contentType: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { contentType } = await params;
  if (!isReviewEntityType(contentType)) return NextResponse.json({ error: "Invalid content type" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const requiredFields = Array.isArray(body?.requiredFields) ? body.requiredFields.filter((f: unknown) => typeof f === "string" && f.trim()) : null;
  if (!requiredFields) return NextResponse.json({ error: "requiredFields array required" }, { status: 400 });

  await sql`
    INSERT INTO content_review_policies (content_type, required_fields, updated_at)
    VALUES (${contentType}, ${requiredFields}, NOW())
    ON CONFLICT (content_type) DO UPDATE SET required_fields = EXCLUDED.required_fields, updated_at = NOW()
  `;

  return NextResponse.json({ success: true });
}
