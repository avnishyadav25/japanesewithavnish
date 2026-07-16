import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { cancelJob } from "@/lib/contentReview/jobRunner";

/** Gap-fix phase 23: cancel a still-queued review job. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await cancelJob(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true });
}
