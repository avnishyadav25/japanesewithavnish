import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { markPostedManually } from "@/lib/social/publications";

/**
 * The manual path's completion step.
 *
 * This is the piece that turns "we generated captions" into "we know what went out and where".
 * The 30-day plan doc asked for this to be tracked in a spreadsheet; it is now a row.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const externalUrl = typeof body?.externalUrl === "string" ? body.externalUrl.trim() : "";

  if (!externalUrl) {
    return NextResponse.json({ error: "Paste the live URL of the post" }, { status: 400 });
  }
  // A typo'd URL recorded as the post's permanent home is worse than no record, and this is the
  // only validation available before someone clicks it a month later.
  try {
    const parsed = new URL(externalUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("not http");
  } catch {
    return NextResponse.json({ error: `"${externalUrl}" is not a valid URL` }, { status: 400 });
  }

  try {
    const post = await markPostedManually({
      postId: id,
      externalUrl,
      postedAt: typeof body?.postedAt === "string" ? body.postedAt : null,
      actor: admin.email,
    });
    return NextResponse.json({ post });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to record" }, { status: 400 });
  }
}
