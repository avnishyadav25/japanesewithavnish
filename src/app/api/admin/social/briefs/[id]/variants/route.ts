import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { listVariants } from "@/lib/social/briefs";
import { listPostsForBrief } from "@/lib/social/publications";

/** Current variants plus their delivery rows, for refreshing the workspace after a generation. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const [variants, posts] = await Promise.all([listVariants(id), listPostsForBrief(id)]);
  return NextResponse.json({ variants, posts });
}
