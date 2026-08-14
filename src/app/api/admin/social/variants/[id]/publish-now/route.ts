import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getBrief, getVariant } from "@/lib/social/briefs";
import { defaultChannelFor } from "@/lib/social/channels";
import { publishArticleDraft } from "@/lib/social/sitePost";
import { markPostedManually, queuePost } from "@/lib/social/publications";
import { platformOf } from "@/lib/social/platforms";
import { BRAND } from "@/lib/brand";

/**
 * Publishes a variant immediately, where the destination allows it inline.
 *
 * Today that is `blog.article` only: it writes a draft post on this site, which is a single
 * database insert and finishes well inside a Netlify function's budget. Every other platform
 * involves moving a video file and belongs on the worker — see the reasoning in migration 143.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const variant = await getVariant(id);
  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

  if (variant.surface !== "blog.article") {
    return NextResponse.json(
      {
        error:
          `${variant.surface} cannot be published from here — it needs the publish worker, ` +
          `which is not wired yet. Use the copy and the platform link, then paste the live URL back.`,
      },
      { status: 400 }
    );
  }

  const brief = await getBrief(variant.briefId);
  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

  const channel = await defaultChannelFor(platformOf(variant.surface));
  if (!channel) return NextResponse.json({ error: "No blog channel configured" }, { status: 400 });

  try {
    const article = await publishArticleDraft(brief, variant, admin.email);

    // Recorded through the same delivery rows as every other platform, so "where did this go"
    // has one answer rather than two.
    const post = await queuePost({
      variantId: variant.id,
      channelId: channel.id,
      delivery: "api",
      actor: admin.email,
    });
    const recorded = await markPostedManually({
      postId: post.id,
      externalUrl: `${BRAND.siteUrl}${article.url}`,
      actor: admin.email,
    });

    return NextResponse.json({
      post: recorded,
      article,
      // The draft still has to clear the review gate; saying so avoids "I published it, where is it?"
      notice: `Draft created at ${article.url}${article.embedded ? " with the video embedded" : ""}. It is a DRAFT — publish it from the blog editor once you have read it.`,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create the draft" }, { status: 400 });
  }
}
