import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { briefForRender, createBrief, listBriefs, slugCampaign } from "@/lib/social/briefs";
import type { BriefSourceType } from "@/lib/social/types";

const SOURCE_TYPES: BriefSourceType[] = ["video_render", "post", "product", "newsletter", "topic"];

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  return NextResponse.json({ briefs: await listBriefs() });
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const sourceType = body?.sourceType as BriefSourceType | undefined;
  if (!sourceType || !SOURCE_TYPES.includes(sourceType)) {
    return NextResponse.json({ error: `sourceType must be one of: ${SOURCE_TYPES.join(", ")}` }, { status: 400 });
  }

  try {
    // Find-or-create, so the Promote button is idempotent: clicking it twice lands on the same
    // workspace rather than splitting one video's copy across two briefs.
    if (sourceType === "video_render") {
      const renderId = typeof body?.renderId === "string" ? body.renderId : null;
      if (!renderId) return NextResponse.json({ error: "renderId is required" }, { status: 400 });
      const brief = await briefForRender(renderId, admin.email);
      return NextResponse.json({ brief });
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const brief = await createBrief({
      sourceType,
      postId: typeof body?.postId === "string" ? body.postId : null,
      sourceRef: typeof body?.sourceRef === "object" && body.sourceRef ? body.sourceRef : {},
      title,
      summary: typeof body?.summary === "string" ? body.summary : null,
      bodyContext: typeof body?.bodyContext === "string" ? body.bodyContext : null,
      jlptLevel: typeof body?.jlptLevel === "string" ? body.jlptLevel : null,
      contentType: typeof body?.contentType === "string" ? body.contentType : null,
      linkPath: typeof body?.linkPath === "string" ? body.linkPath : null,
      utmCampaign: typeof body?.utmCampaign === "string" ? body.utmCampaign : slugCampaign(title),
      createdBy: admin.email,
    });
    return NextResponse.json({ brief });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create brief" }, { status: 400 });
  }
}
