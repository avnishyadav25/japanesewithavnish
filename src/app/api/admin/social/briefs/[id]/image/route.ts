import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import { generateImageWithGemini } from "@/lib/ai/image-providers/gemini";
import { backgroundPrompt } from "@/lib/social/imageSizes";

/**
 * Generates ONE background illustration for a brief, and stores composited images.
 *
 * WHY ONE AT A TIME. A Gemini image takes 8.6s measured; three would be ~26s against a ~30s
 * function ceiling. The client asks three times and shows progress — the same loop the batch panel
 * and the multi-language generate already use.
 *
 * WHY THE TEXT IS NOT DRAWN HERE. `sharp` can render SVG text, but it silently ignores an embedded
 * @font-face and always falls back to system fonts — verified: a deliberately nonexistent
 * font-family rendered identically to an embedded one. On a serverless function that means no DM
 * Sans and, worse, no CJK font, so Japanese would come out as tofu boxes. The admin's browser
 * already has DM Sans loaded by next/font and a CJK font from the OS, so it composites the text on
 * a canvas and posts the finished PNG back to `action: "save"`. That also makes it WYSIWYG.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action === "save" ? "save" : "background";

  const briefRows = (await sql`
    SELECT id, title, summary, jlpt_level, content_type, post_id, render_id
    FROM social_briefs WHERE id = ${id}::uuid
  `) as {
    id: string;
    title: string;
    summary: string | null;
    jlpt_level: string | null;
    content_type: string | null;
    post_id: string | null;
    render_id: string | null;
  }[];
  const brief = briefRows[0];
  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

  // ---- store composited images ---------------------------------------------
  if (action === "save") {
    const images = (Array.isArray(body?.images) ? body.images : []) as {
      sizeKey: string;
      dataUrl: string;
      surfaces?: string[];
    }[];
    if (images.length === 0) return NextResponse.json({ error: "No images to save" }, { status: 400 });

    const saved: { sizeKey: string; url: string }[] = [];
    for (const image of images) {
      const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(image.dataUrl ?? "");
      if (!match) continue;
      const buf = Buffer.from(match[2], "base64");
      // 8MB ceiling: a 1200x630 PNG is ~1MB, so anything far larger is a mistake rather than a
      // deliberate upload, and this route is not a general file host.
      if (buf.length > 8 * 1024 * 1024) {
        return NextResponse.json({ error: `${image.sizeKey} is ${Math.round(buf.length / 1e6)}MB — too large` }, { status: 413 });
      }
      const key = `social/images/${id}/${image.sizeKey}-${Date.now()}.${match[1] === "png" ? "png" : "jpg"}`;
      const url = await uploadToR2(key, buf, `image/${match[1]}`);
      saved.push({ sizeKey: image.sizeKey, url });

      // Appended to every variant of the surfaces this size serves. jsonb || append rather than a
      // read-modify-write, so two saves cannot clobber each other's media.
      const surfaces = image.surfaces ?? [];
      if (surfaces.length > 0) {
        const entry = JSON.stringify([{ kind: "image", url, mimeType: `image/${match[1]}`, sizeKey: image.sizeKey }]);
        await sql`
          UPDATE social_variants
          SET media = COALESCE(media, '[]'::jsonb) || ${entry}::jsonb, updated_at = NOW()
          WHERE brief_id = ${id}::uuid AND is_current AND surface = ANY(${surfaces})
        `;
      }
    }

    // The og:image gap: generation scripts have never written one, so every share of a generated
    // post renders whatever the site default is. When the brief came from a post, the link-preview
    // size fills it — only if the post has none, so a hand-picked image is never overwritten.
    let postUpdated = false;
    const og = saved.find((s) => s.sizeKey === "og_image");
    if (og && brief.post_id) {
      const rows = (await sql`
        UPDATE posts SET og_image_url = ${og.url}, updated_at = NOW()
        WHERE id = ${brief.post_id}::uuid AND (og_image_url IS NULL OR og_image_url = '')
        RETURNING id
      `) as { id: string }[];
      postUpdated = rows.length > 0;
    }

    return NextResponse.json({
      saved,
      postUpdated,
      message:
        `Saved ${saved.length} image${saved.length === 1 ? "" : "s"}` +
        (postUpdated ? " and set the post's link-preview image" : "") +
        ".",
    });
  }

  // ---- generate one background ---------------------------------------------
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set — no image model to generate with." },
      { status: 503 }
    );
  }

  const prompt =
    typeof body?.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim()
      : backgroundPrompt({
          topic: brief.summary?.trim() || brief.title,
          jlptLevel: brief.jlpt_level,
          contentType: brief.content_type,
          textSide: body?.textSide === "right" ? "right" : body?.textSide === "bottom" ? "bottom" : "left",
        });

  try {
    const result = await generateImageWithGemini(prompt);
    const buf = result.buffer;
    const ext = result.mime.includes("jpeg") ? "jpg" : "png";
    const key = `social/backgrounds/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const url = await uploadToR2(key, buf, result.mime);

    return NextResponse.json({
      url,
      prompt,
      bytes: buf.length,
      // Returned so the UI can show what was asked for and let it be edited before retrying.
      note: result.textResponse ? String(result.textResponse).slice(0, 300) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation failed" },
      { status: 502 }
    );
  }
}
