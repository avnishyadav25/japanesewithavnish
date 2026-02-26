import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, slug, price_paise")
    .eq("slug", slug)
    .single();

  if (error || !product) {
    return NextResponse.json({ product: null }, { status: 404 });
  }
  return NextResponse.json({ product });
}
