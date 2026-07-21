import { sql } from "@/lib/db";
import type { AudioData, ComprehensionQuestionData } from "@/lib/blocks/blockTypes";
import { getContentBlockPublishGateStatus } from "@/lib/blocks/publishGate";

/**
 * Keeps listening_scenarios/listening_questions (the live source the public
 * listening page + its real user attempt-tracking read from — see
 * src/app/(main)/learn/listening/[slug]/page.tsx) in sync with edits made
 * through the new content_blocks admin editor, so block edits actually show
 * up for real users instead of silently going nowhere.
 *
 * Safety-critical constraint: listening_attempts.scenario_id has
 * ON DELETE CASCADE — deleting and recreating a listening_scenarios row
 * would destroy real users' quiz history. This function only ever UPDATEs
 * an existing scenario row in place (or INSERTs one if none exists yet),
 * never deletes one. listening_questions rows are safe to delete+recreate
 * (nothing references listening_questions.id as a FK target; attempts store
 * a self-contained score/answers snapshot, not a live join to question rows).
 *
 * Call after any content_blocks mutation for a listening post.
 */
export async function syncListeningBlocksToScenario(postId: string): Promise<void> {
  if (!sql) return;

  const postRows = (await sql`SELECT title, content_type FROM posts WHERE id = ${postId} LIMIT 1`) as { title: string; content_type: string }[];
  const post = postRows[0];
  if (!post || post.content_type !== "listening") return;

  // Enforce the mandatory publish gate HERE, not just at the post-level status
  // transition — an already-published listening post's blocks can be edited
  // without ever re-triggering that check, so this is the actual point where
  // public visibility would change. A partial/incomplete set of blocks must
  // never overwrite a live scenario; the old (complete) data stays authoritative
  // until a full, gate-passing set of blocks is ready.
  const gate = await getContentBlockPublishGateStatus(postId, "listening");
  if (gate.blocked) return;

  // The `listening` sidecar row should already exist (syncPostToTypeTable runs
  // on every learning-content save), but ensure it defensively.
  const listeningRows = (await sql`
    INSERT INTO listening (post_id, title, updated_at)
    VALUES (${postId}, ${post.title}, NOW())
    ON CONFLICT (post_id) DO UPDATE SET updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  const listeningId = listeningRows[0]?.id;
  if (!listeningId) return;

  // Only published blocks sync to the live tables — a draft/pending-review block
  // (e.g. AI-drafted content awaiting human approval) must not reach real users
  // just because someone touched a sibling block; that would defeat the review gate.
  const blockRows = (await sql`
    SELECT block_type, block_data FROM content_blocks
    WHERE post_id = ${postId} AND block_type IN ('audio', 'comprehension_question') AND status = 'published'
    ORDER BY sort_order
  `) as { block_type: "audio" | "comprehension_question"; block_data: Record<string, unknown> }[];

  const audioBlock = blockRows.find((b) => b.block_type === "audio")?.block_data as unknown as AudioData | undefined;
  const questionBlocks = blockRows.filter((b) => b.block_type === "comprehension_question").map((b) => b.block_data as unknown as ComprehensionQuestionData);

  if (!audioBlock?.audioUrl) return; // nothing to sync yet

  const existingScenarioRows = (await sql`
    SELECT id FROM listening_scenarios WHERE listening_id = ${listeningId} ORDER BY sort_order LIMIT 1
  `) as { id: string }[];

  let scenarioId = existingScenarioRows[0]?.id;
  if (scenarioId) {
    // UPDATE in place — never delete/recreate, listening_attempts.scenario_id
    // has ON DELETE CASCADE and would silently wipe real users' quiz history.
    await sql`
      UPDATE listening_scenarios SET
        title = ${post.title},
        audio_url = ${audioBlock.audioUrl},
        transcript = ${audioBlock.transcript ?? null},
        updated_at = NOW()
      WHERE id = ${scenarioId}
    `;
  } else {
    const inserted = (await sql`
      INSERT INTO listening_scenarios (listening_id, title, audio_url, transcript)
      VALUES (${listeningId}, ${post.title}, ${audioBlock.audioUrl}, ${audioBlock.transcript ?? null})
      RETURNING id
    `) as { id: string }[];
    scenarioId = inserted[0]?.id;
  }
  if (!scenarioId) return;

  // Safe to delete+recreate: no FK targets listening_questions.id, and
  // listening_attempts stores a self-contained score/answers snapshot rather
  // than a live join back to question rows.
  await sql`DELETE FROM listening_questions WHERE scenario_id = ${scenarioId}`;
  let sortOrder = 0;
  for (const q of questionBlocks) {
    if (!q.question || !Array.isArray(q.choices) || q.choices.length === 0) continue;
    const options = q.choices.map((c) => c.text);
    const correctIndex = q.choices.findIndex((c) => c.isCorrect);
    if (correctIndex === -1) continue;
    await sql`
      INSERT INTO listening_questions (scenario_id, question_text, options, correct_index, explanation, sort_order)
      VALUES (${scenarioId}, ${q.question}, ${JSON.stringify(options)}::jsonb, ${correctIndex}, ${q.explanation ?? null}, ${sortOrder})
    `;
    sortOrder += 10;
  }
}
