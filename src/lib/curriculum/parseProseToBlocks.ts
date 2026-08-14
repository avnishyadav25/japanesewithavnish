import { slugify } from "@/lib/slugify";
import type { BlockType } from "@/lib/blocks/blockTypes";

export type PlannedBlock = { block_type: BlockType; block_data: Record<string, unknown> };

/**
 * Splits Markdown lesson body text at H2 (`## `) headers into
 * (Section Heading, Rich Text) block pairs. Rich Text blocks keep the original
 * Markdown so they render through the same interactive pipeline as the legacy
 * lesson body (TTS buttons, writing-practice modal, callout boxes).
 */
export function parseProseToBlocks(markdown: string): PlannedBlock[] {
  const lines = markdown.split("\n");
  const blocks: PlannedBlock[] = [];
  const preamble: string[] = [];
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      if (current) sections.push(current);
      current = { heading: h2[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(current);

  const preambleText = preamble.join("\n").trim();
  if (preambleText) {
    blocks.push({ block_type: "rich_text", block_data: { markdown: preambleText } });
  }
  for (const s of sections) {
    const title = s.heading.replace(/\*\*/g, "").replace(/`/g, "").trim();
    blocks.push({ block_type: "section_heading", block_data: { title, anchorId: slugify(title) } });
    const bodyText = s.body.join("\n").trim();
    if (bodyText) {
      blocks.push({ block_type: "rich_text", block_data: { markdown: bodyText } });
    }
  }
  return blocks;
}
