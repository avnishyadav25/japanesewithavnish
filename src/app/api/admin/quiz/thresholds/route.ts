import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const VALID_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const rows = await sql`SELECT level, min_score, recommended_product_id FROM quiz_thresholds ORDER BY level`;
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Admin quiz thresholds GET error:", error);
    return NextResponse.json({ error: "Failed to fetch thresholds" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { level, min_score, recommended_product_id } = await req.json();
    if (!VALID_LEVELS.includes(level) || min_score == null) {
      return NextResponse.json({ error: "level and min_score are required" }, { status: 400 });
    }

    await sql`
      INSERT INTO quiz_thresholds (level, min_score, recommended_product_id, created_at)
      VALUES (${level}, ${Number(min_score)}, ${recommended_product_id || null}, NOW())
      ON CONFLICT (level) DO UPDATE SET min_score = EXCLUDED.min_score, recommended_product_id = EXCLUDED.recommended_product_id
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin quiz thresholds PATCH error:", error);
    return NextResponse.json({ error: "Failed to update threshold" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
