import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { applyFindingFix } from "@/lib/contentReview/applyFix";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Edit Fix: an editedValue in the body means the human adjusted the AI's suggestion
  // before applying it, per the spec's distinct Accept-Fix vs Edit-Fix actions.
  const body = await req.json().catch(() => null);
  const hasEditedValue = body && Object.prototype.hasOwnProperty.call(body, "editedValue");

  const result = await applyFindingFix(id, hasEditedValue ? body.editedValue : undefined);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
