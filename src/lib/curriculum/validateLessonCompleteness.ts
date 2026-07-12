import { sql } from "@/lib/db";
import { BLOCK_TYPE_LABELS, validateBlockData, type BlockType } from "@/lib/curriculum/blockTypes";
import { getLessonTemplateBlocks } from "@/lib/curriculum/lessonTemplates";

export type CompletenessItem = { blockType: BlockType; label: string; present: boolean };

/** Non-blocking check: for each block type the lesson's content-type template calls for,
 * is there at least one block of that type on the lesson with genuinely valid (non-empty) data? */
export async function validateLessonCompleteness(lessonId: string, contentType: string | null): Promise<CompletenessItem[]> {
  const requiredTypes = Array.from(new Set(getLessonTemplateBlocks(contentType).map((b) => b.block_type)));
  if (!sql || requiredTypes.length === 0) return [];

  const rows = (await sql`
    SELECT block_type, block_data FROM lesson_blocks WHERE lesson_id = ${lessonId}
  `) as { block_type: BlockType; block_data: Record<string, unknown> }[];

  return requiredTypes.map((blockType) => {
    const present = rows.some((r) => r.block_type === blockType && validateBlockData(blockType, r.block_data).length === 0);
    return { blockType, label: BLOCK_TYPE_LABELS[blockType], present };
  });
}
