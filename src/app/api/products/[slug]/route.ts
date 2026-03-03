import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!sql) return NextResponse.json({ product: null }, { status: 503 });
  const rows = (await sql`SELECT id, name, slug, price_paise FROM products WHERE slug = ${slug} LIMIT 1`) as { id: string; name: string; slug: string; price_paise: number }[];
  const row = rows[0] ?? null;
  if (!row) return NextResponse.json({ product: null }, { status: 404 });
  const product = { id: row.id, name: row.name, slug: row.slug, price_paise: Number(row.price_paise) };
  return NextResponse.json({ product });
}
