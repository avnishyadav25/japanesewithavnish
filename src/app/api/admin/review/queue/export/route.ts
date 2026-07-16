import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** "Export findings" bulk action — CSV of every open finding for the given posts (query
 * param ?ids=uuid,uuid,...), not the posts themselves, since findings are what a reviewer
 * actually wants to audit offline. */
export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (ids.length === 0) return NextResponse.json({ error: "ids query param required" }, { status: 400 });

  const rows = (await sql`
    SELECT p.title, p.slug, p.content_type, f.severity, f.category, f.agent_key, f.title AS finding_title,
           f.description, f.why_it_matters, f.status, f.created_at
    FROM posts p
    JOIN content_review_findings f ON f.review_run_id = p.last_review_run_id
    WHERE p.id = ANY(${ids})
    ORDER BY p.title, CASE f.severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END
  `) as {
    title: string;
    slug: string;
    content_type: string;
    severity: string;
    category: string;
    agent_key: string;
    finding_title: string;
    description: string;
    why_it_matters: string | null;
    status: string;
    created_at: string;
  }[];

  const header = ["Content Title", "Slug", "Type", "Severity", "Category", "Agent", "Finding", "Description", "Why It Matters", "Status", "Created At"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.title, r.slug, r.content_type, r.severity, r.category, r.agent_key, r.finding_title, r.description, r.why_it_matters, r.status, r.created_at]
        .map(csvEscape)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="review-findings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
