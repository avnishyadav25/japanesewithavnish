import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const rows = await sql`
    SELECT id, entity_type, entity_id, slug, title, description, summary, link, reference_image_url, payload, image_urls, created_at, updated_at
    FROM social_content_packs WHERE id = ${id} LIMIT 1
  ` as { id: string; entity_type: string; entity_id: string | null; slug: string; title: string; description: string | null; summary: string | null; link: string | null; reference_image_url: string | null; payload: Record<string, unknown>; image_urls: Record<string, string> | null; created_at: string; updated_at: string }[];

  const pack = rows[0];
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pack);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const imageUrls = body.image_urls as Record<string, string> | undefined;
  const payloadMerge = body.payload as Record<string, unknown> | undefined;
  const referenceImageUrl = body.reference_image_url as string | undefined;
  const description = body.description as string | undefined;
  const summary = body.summary as string | undefined;
  const link = body.link as string | undefined;

  if (!imageUrls && payloadMerge === undefined && referenceImageUrl === undefined && description === undefined && summary === undefined && link === undefined) {
    return NextResponse.json({ error: "Provide image_urls, payload, reference_image_url, description, summary, or link for PATCH" }, { status: 400 });
  }

  if (payloadMerge !== undefined && typeof payloadMerge !== "object") {
    return NextResponse.json({ error: "payload must be an object" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rows = await sql`
    SELECT payload, image_urls, reference_image_url, description, summary, link
    FROM social_content_packs WHERE id = ${id} LIMIT 1
  ` as { payload: Record<string, unknown>; image_urls: Record<string, string> | null; reference_image_url: string | null; description: string | null; summary: string | null; link: string | null }[];
  const current = rows[0];
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextImageUrls = imageUrls ?? current.image_urls ?? {};
  const nextPayload = payloadMerge !== undefined ? deepMerge(current.payload || {}, payloadMerge) : (current.payload || {});
  const nextRefUrl = referenceImageUrl !== undefined ? (referenceImageUrl === "" ? null : referenceImageUrl) : current.reference_image_url;
  const nextDescription = description !== undefined ? (description === "" ? null : description) : current.description;
  const nextSummary = summary !== undefined ? (summary === "" ? null : summary) : current.summary;
  const nextLink = link !== undefined ? (link === "" ? null : link) : current.link;

  await sql`
    UPDATE social_content_packs SET
      image_urls = ${nextImageUrls},
      payload = ${JSON.stringify(nextPayload)}::jsonb,
      reference_image_url = ${nextRefUrl},
      description = ${nextDescription},
      summary = ${nextSummary},
      link = ${nextLink},
      updated_at = ${now}
    WHERE id = ${id}
  `;
  return NextResponse.json({ success: true });
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = out[key];
    if (s != null && typeof s === "object" && !Array.isArray(s) && t != null && typeof t === "object" && !Array.isArray(t)) {
      out[key] = deepMerge(t as Record<string, unknown>, s as Record<string, unknown>);
    } else {
      out[key] = s;
    }
  }
  return out;
}
