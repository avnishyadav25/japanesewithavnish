import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { disconnectChannel, getChannel, updateChannel } from "@/lib/social/channels";

/** Reads the public view only — `credentials_sealed` cannot reach this response by construction. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  return NextResponse.json({ channel });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  const body = await req.json().catch(() => null);

  if (body?.disconnect === true) {
    await disconnectChannel(id);
    return NextResponse.json({ channel: await getChannel(id) });
  }

  // Enabling auto-post without credentials would queue posts against a channel that cannot
  // publish them, which fails later and less legibly than refusing here.
  if (body?.autoPostEnabled === true && !channel.hasCredentials) {
    return NextResponse.json(
      { error: `${channel.label} has no stored credentials — connect it first.` },
      { status: 400 }
    );
  }

  const updated = await updateChannel(id, {
    label: typeof body?.label === "string" ? body.label : undefined,
    handle: typeof body?.handle === "string" ? body.handle : undefined,
    config: typeof body?.config === "object" && body.config ? body.config : undefined,
    isEnabled: typeof body?.isEnabled === "boolean" ? body.isEnabled : undefined,
    autoPostEnabled: typeof body?.autoPostEnabled === "boolean" ? body.autoPostEnabled : undefined,
  });

  return NextResponse.json({ channel: updated });
}
