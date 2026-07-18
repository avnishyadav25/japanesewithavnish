import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { buildStepPlan, initJobState, alreadyHasContent } from "@/lib/practiceTest/generateMockTest";
import type { JlptLevel } from "@/lib/practiceTest/itemTypes";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

/** Creates a mock-test generation job — fast (no LLM calls here), returns immediately with a
 * jobId. The admin modal then drives progress by repeatedly POSTing to
 * /api/admin/practice-tests/generate/[jobId]/step, each call advancing exactly one step. */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const level = typeof body?.level === "string" ? body.level.toUpperCase() : null;
  const variant = body?.variant === "mini" ? "mini" : body?.variant === "full" ? "full" : null;
  const targetPostId = typeof body?.targetPostId === "string" ? body.targetPostId : null;
  const questionCounts =
    body?.questionCounts && typeof body.questionCounts === "object" ? (body.questionCounts as Record<string, number>) : undefined;

  if (!level || !LEVELS.includes(level) || !variant) {
    return NextResponse.json({ error: "level (N5-N1) and variant (full|mini) are required" }, { status: 400 });
  }

  let slug: string;
  let title: string;

  if (targetPostId) {
    const postRows = (await sql`SELECT id, slug, title FROM posts WHERE id = ${targetPostId} AND content_type = 'practice_test' LIMIT 1`) as {
      id: string;
      slug: string;
      title: string;
    }[];
    if (!postRows[0]) return NextResponse.json({ error: "Target post not found" }, { status: 404 });
    slug = postRows[0].slug;
    title = postRows[0].title;
  } else {
    // Same deterministic-slug convention as the CLI script, so the two never collide — find the
    // next free "full mock" index, or reuse the single mini slug (skip-if-exists is enforced
    // below, matching the CLI's --force semantics).
    if (variant === "mini") {
      slug = `jlpt-${level.toLowerCase()}-mini-mock`;
      title = `${level} Mini Mock Test`;
    } else {
      let index = 1;
      slug = `jlpt-${level.toLowerCase()}-full-mock-${index}`;
      while (await alreadyHasContent(slug)) {
        index += 1;
        slug = `jlpt-${level.toLowerCase()}-full-mock-${index}`;
      }
      title = `${level} Full Mock Test ${index}`;
    }
    if (await alreadyHasContent(slug)) {
      return NextResponse.json({ error: `${slug} already has content — delete it first or generate into an existing post instead` }, { status: 409 });
    }
  }

  const steps = buildStepPlan(level as JlptLevel, variant, questionCounts);
  const state = initJobState(level as JlptLevel, variant, slug, title, targetPostId);

  const rows = (await sql`
    INSERT INTO practice_test_generation_jobs (status, level, variant, target_post_id, steps, step_index, state, requested_by)
    VALUES ('running', ${level}, ${variant}, ${targetPostId}, ${JSON.stringify(steps)}::jsonb, 0, ${JSON.stringify(state)}::jsonb, ${admin.email})
    RETURNING id
  `) as { id: string }[];

  return NextResponse.json({ jobId: rows[0].id, totalSteps: steps.length });
}
