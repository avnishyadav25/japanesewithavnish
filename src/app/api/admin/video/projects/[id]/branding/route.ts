import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { logEvent } from "@/lib/video/projects";
import { DEFAULT_BRANDING } from "@/lib/video/branding";
import { isGenerated } from "@/lib/video/mascots";
import type { BrandingSettings } from "@/lib/video/types";

const LOGOS = new Set(["badge", "symbol", "none"]);

/**
 * Per-project brand overrides.
 *
 * `BrandingSettings.mascot` has existed on the type since branding landed and was never read by
 * anything — the outro hardcoded fox-celebrate and the intro hardcoded fox-wave. This is the
 * write side of making it real.
 *
 * A mascot with no PNG on disk is rejected rather than stored: it would render as a broken image
 * in the middle of a finished video, which is worse than not offering the choice.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const incoming = (body?.branding ?? body) as Partial<BrandingSettings>;

  if (incoming.mascot !== undefined && incoming.mascot !== null && !isGenerated(String(incoming.mascot))) {
    return NextResponse.json(
      { error: `No artwork for "${incoming.mascot}". Run npm run video:mascots -- --only <character>:<pose> first.` },
      { status: 400 }
    );
  }

  const branding: Partial<BrandingSettings> = {
    logo: LOGOS.has(String(incoming.logo)) ? (incoming.logo as BrandingSettings["logo"]) : DEFAULT_BRANDING.logo,
    logoOpacity: Math.min(1, Math.max(0, Number(incoming.logoOpacity) || DEFAULT_BRANDING.logoOpacity)),
    mascots: incoming.mascots !== false,
    ...(incoming.mascot ? { mascot: String(incoming.mascot) } : {}),
    ...(typeof incoming.hashtag === "string" ? { hashtag: incoming.hashtag.trim() || undefined } : {}),
  };

  const rows = (await sql`
    UPDATE video_projects SET branding = ${JSON.stringify(branding)}::jsonb, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id
  `) as { id: string }[];
  if (rows.length === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await logEvent({ projectId: id, actor: admin.email, eventType: "branding_updated", payload: branding });

  return NextResponse.json({
    ok: true,
    branding,
    // Branding is frozen into the storyboard at generation so a re-render reproduces what was
    // approved. Changing it therefore needs a new script, unlike caption style.
    message: "Saved. Regenerate the script to apply it to this project's videos.",
  });
}
