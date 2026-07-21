import { sql } from "@/lib/db";
import { validateBlockData, type BlockType, type AudioData, type ComprehensionQuestionData } from "@/lib/blocks/blockTypes";

export interface BlockPublishGateStatus {
  blocked: boolean;
  reasons: string[];
}

type ContentBlockRow = {
  block_type: BlockType;
  block_data: Record<string, unknown>;
  status: "draft" | "published";
  review_status: "none" | "pending" | "approved" | "rejected";
};

/**
 * Structural completeness gate for content_blocks, additive to the existing
 * AI-content-review gate (getPublishGateStatus in contentReview/publishGate.ts).
 * Only listening has a genuinely mandatory rule per the founder's spec — other
 * types get advisory warnings elsewhere (the admin block editor), not a hard
 * block, since only Listening was described as truly mandatory.
 */
export async function getContentBlockPublishGateStatus(postId: string, contentType: string): Promise<BlockPublishGateStatus> {
  if (!sql) return { blocked: false, reasons: [] };
  if (contentType !== "listening") return { blocked: false, reasons: [] };

  const rows = (await sql`
    SELECT block_type, block_data, status, review_status FROM content_blocks WHERE post_id = ${postId}
  `) as ContentBlockRow[];

  const reasons: string[] = [];

  const publishedAudio = rows.filter(
    (b) => b.block_type === "audio" && b.status === "published" && validateBlockData("audio", b.block_data).length === 0
  );
  if (publishedAudio.length === 0) {
    reasons.push("no published audio block");
  } else {
    const audio = publishedAudio[0].block_data as unknown as AudioData;
    if (!audio.transcript?.trim()) reasons.push("audio block is missing a transcript");
    if (!audio.durationSeconds) reasons.push("audio block is missing a duration");
  }

  const publishedQuestions = rows.filter(
    (b) => b.block_type === "comprehension_question" && b.status === "published" && validateBlockData("comprehension_question", b.block_data).length === 0
  );
  if (publishedQuestions.length < 3) {
    reasons.push(`only ${publishedQuestions.length} comprehension question(s) published, minimum is 3`);
  }
  const missingExplanations = publishedQuestions.filter((q) => !(q.block_data as unknown as ComprehensionQuestionData).explanation?.trim());
  if (missingExplanations.length > 0) {
    reasons.push(`${missingExplanations.length} comprehension question(s) missing an explanation`);
  }

  const pending = rows.filter((b) => b.review_status === "pending");
  if (pending.length > 0) {
    reasons.push(`${pending.length} block(s) still pending review`);
  }

  return { blocked: reasons.length > 0, reasons };
}
