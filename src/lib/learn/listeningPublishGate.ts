import { sql } from "@/lib/db";

/**
 * A listening post is only "complete" (safe to show as an active lesson) once it has at
 * least one scenario with real audio + a transcript + 3 or more questions. `posts.status`
 * alone isn't enough to gate this — a listening post can be published with zero or
 * incomplete scenarios underneath it (see P0-7 audit finding).
 */
export async function getCompleteListeningPostIds(): Promise<Set<string>> {
  if (!sql) return new Set();

  const rows = (await sql`
    SELECT DISTINCT l.post_id
    FROM listening l
    JOIN listening_scenarios ls ON ls.listening_id = l.id
    WHERE ls.audio_url IS NOT NULL AND ls.audio_url != ''
      AND ls.transcript IS NOT NULL AND ls.transcript != ''
      AND (SELECT COUNT(*) FROM listening_questions lq WHERE lq.scenario_id = ls.id) >= 3
  `) as { post_id: string }[];

  return new Set(rows.map((r) => r.post_id));
}
