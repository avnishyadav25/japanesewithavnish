import { sql } from "@/lib/db";

/**
 * Some "reading" posts are actually kana-recognition or grammar-in-context lesson
 * drills (title prefix "Reading practice: ...") rather than genuine reading-comprehension
 * passages. The public /learn/reading library should only surface real passages.
 */
export async function getPassageReadingPostIds(): Promise<Set<string>> {
  if (!sql) return new Set();

  const rows = (await sql`
    SELECT post_id FROM reading WHERE reading_kind = 'passage'
  `) as { post_id: string }[];

  return new Set(rows.map((r) => r.post_id));
}
