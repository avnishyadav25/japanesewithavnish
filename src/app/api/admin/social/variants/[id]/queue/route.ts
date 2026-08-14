import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getVariant } from "@/lib/social/briefs";
import { defaultChannelFor, getChannel } from "@/lib/social/channels";
import { resolveAdapter } from "@/lib/social/adapters";
import { queuePost } from "@/lib/social/publications";
import { platformOf } from "@/lib/social/platforms";

/**
 * Queues a variant for delivery to a channel.
 *
 * `resolveAdapter()` decides whether this becomes a real API publish or the manual path, using
 * the four-condition gate in src/lib/social/adapters/index.ts. Today every platform resolves to
 * manual, so this marks the post `awaiting_manual` and hands back the intent URL — which is the
 * working path, not a degraded one.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const variant = await getVariant(id);
  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const platform = platformOf(variant.surface);

  const channel =
    typeof body?.channelId === "string" ? await getChannel(body.channelId) : await defaultChannelFor(platform);
  if (!channel) {
    return NextResponse.json({ error: `No channel configured for ${platform}` }, { status: 400 });
  }
  if (channel.platform !== platform) {
    return NextResponse.json(
      { error: `Channel is for ${channel.platform} but this variant is for ${platform}` },
      { status: 400 }
    );
  }

  const adapter = resolveAdapter(channel);
  const capability = adapter.capability(channel);
  const delivery = capability.autoPost ? "api" : "manual";

  const scheduledFor = typeof body?.scheduledFor === "string" ? body.scheduledFor : null;
  const post = await queuePost({ variantId: id, channelId: channel.id, scheduledFor, delivery, actor: admin.email });

  return NextResponse.json({
    post,
    delivery,
    // Surfaced so the UI can explain why this is manual rather than just showing a disabled button.
    reason: capability.reason ?? null,
  });
}
