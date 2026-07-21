import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { runStep, finalizeNewTest, finalizeAppendToPost, type JobStep, type JobState } from "@/lib/practiceTest/generateMockTest";

type JobRow = {
  id: string;
  status: "running" | "completed" | "failed";
  target_post_id: string | null;
  result_post_id: string | null;
  steps: JobStep[];
  step_index: number;
  state: JobState;
  log: string[];
  error_message: string | null;
};

/** Advances a generation job by exactly one step (one LLM call, or the final DB write on the
 * last step) and persists the result — safe to call repeatedly; a job already 'completed' or
 * 'failed' just returns its current state as a no-op. The admin modal polls this in a loop. */
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { jobId } = await params;

  const rows = (await sql`SELECT * FROM practice_test_generation_jobs WHERE id = ${jobId} LIMIT 1`) as JobRow[];
  const job = rows[0];
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.status !== "running") {
    return NextResponse.json(jobToResponse(job));
  }

  const step = job.steps[job.step_index];
  if (!step) {
    // Shouldn't happen (finalize is always the last step), but fail safe rather than loop forever.
    await sql`UPDATE practice_test_generation_jobs SET status = 'failed', error_message = 'No step at index', updated_at = NOW() WHERE id = ${jobId}`;
    return NextResponse.json(jobToResponse({ ...job, status: "failed", error_message: "No step at index" }));
  }

  try {
    if (step.kind === "finalize") {
      if (job.target_post_id) {
        await finalizeAppendToPost(job.state);
        await sql`
          UPDATE practice_test_generation_jobs
          SET status = 'completed', result_post_id = ${job.target_post_id}, log = log || ${JSON.stringify(["Added sections to existing post"])}::jsonb, updated_at = NOW()
          WHERE id = ${jobId}
        `;
        const updated = (await sql`SELECT * FROM practice_test_generation_jobs WHERE id = ${jobId}`) as JobRow[];
        return NextResponse.json(jobToResponse(updated[0]));
      } else {
        const result = await finalizeNewTest(job.state);
        await sql`
          UPDATE practice_test_generation_jobs
          SET status = 'completed', result_post_id = ${result.postId},
              log = log || ${JSON.stringify([`Created test: ${result.totalQuestions} questions, ${result.durationMinutes} min`])}::jsonb,
              updated_at = NOW()
          WHERE id = ${jobId}
        `;
        const updated = (await sql`SELECT * FROM practice_test_generation_jobs WHERE id = ${jobId}`) as JobRow[];
        return NextResponse.json(jobToResponse(updated[0]));
      }
    }

    const logLine = await runStep(job.state, step);
    const nextIndex = job.step_index + 1;
    await sql`
      UPDATE practice_test_generation_jobs
      SET step_index = ${nextIndex}, state = ${JSON.stringify(job.state)}::jsonb, log = log || ${JSON.stringify([logLine])}::jsonb, updated_at = NOW()
      WHERE id = ${jobId}
    `;
    const updated = (await sql`SELECT * FROM practice_test_generation_jobs WHERE id = ${jobId}`) as JobRow[];
    return NextResponse.json(jobToResponse(updated[0]));
  } catch (e) {
    const message = (e as Error).message;
    await sql`UPDATE practice_test_generation_jobs SET status = 'failed', error_message = ${message}, updated_at = NOW() WHERE id = ${jobId}`;
    // A partially-generated brand-new-post job has nothing in the DB yet (finalize hasn't run),
    // so there's nothing to roll back here — the failure is always mid-generation, pre-insert.
    return NextResponse.json(jobToResponse({ ...job, status: "failed", error_message: message }));
  }
}

function jobToResponse(job: JobRow) {
  return {
    jobId: job.id,
    status: job.status,
    stepIndex: job.step_index,
    totalSteps: job.steps.length,
    log: job.log,
    resultPostId: job.result_post_id,
    resultPostSlug: job.state?.slug ?? null,
    errorMessage: job.error_message,
  };
}
