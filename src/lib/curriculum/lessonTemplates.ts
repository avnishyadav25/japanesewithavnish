import type { BlockType } from "@/lib/curriculum/blockTypes";

export type TemplateBlock = { block_type: BlockType; block_data: Record<string, unknown> };

const GENERIC_SCAFFOLD: TemplateBlock[] = [
  { block_type: "section_heading", block_data: { title: "Introduction" } },
  { block_type: "rich_text", block_data: { markdown: "" } },
];

const TEMPLATES: Record<string, TemplateBlock[]> = {
  grammar: [
    { block_type: "section_heading", block_data: { title: "Concept" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "grammar_rule", block_data: { grammarIds: [] } },
    { block_type: "example_set", block_data: { exampleIds: [] } },
  ],
  vocabulary: [
    { block_type: "section_heading", block_data: { title: "New Vocabulary" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "vocabulary_set", block_data: { vocabularyIds: [] } },
    { block_type: "example_set", block_data: { exampleIds: [] } },
  ],
  kanji: [
    { block_type: "section_heading", block_data: { title: "Kanji Focus" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "kanji_focus", block_data: { kanjiIds: [] } },
    { block_type: "example_set", block_data: { exampleIds: [] } },
  ],
  kana: [
    { block_type: "section_heading", block_data: { title: "Characters" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "kana_grid", block_data: { kanaIds: [] } },
  ],
  reading: [
    { block_type: "section_heading", block_data: { title: "Reading Passage" } },
    { block_type: "reading_passage", block_data: { title: "", passage: "" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
  ],
  listening: [
    { block_type: "section_heading", block_data: { title: "Audio" } },
    { block_type: "audio", block_data: { audioUrl: "" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
  ],
  writing: [
    { block_type: "section_heading", block_data: { title: "Writing Practice" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "tip", block_data: { text: "" } },
  ],
  conversation: [
    { block_type: "section_heading", block_data: { title: "Dialogue" } },
    { block_type: "dialogue", block_data: { lines: [] } },
    { block_type: "rich_text", block_data: { markdown: "" } },
  ],
  orientation: [
    { block_type: "section_heading", block_data: { title: "Orientation" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "summary", block_data: { items: [] } },
  ],
  pronunciation: [
    { block_type: "section_heading", block_data: { title: "Pronunciation Focus" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "pronunciation", block_data: { targetSound: "", correctGuidance: "" } },
    { block_type: "audio", block_data: { audioUrl: "" } },
  ],
  speaking: [
    { block_type: "section_heading", block_data: { title: "Speaking Practice" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "dialogue", block_data: { lines: [] } },
    { block_type: "tip", block_data: { text: "" } },
  ],
  culture: [
    { block_type: "section_heading", block_data: { title: "Culture Note" } },
    { block_type: "culture_note", block_data: { text: "" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
  ],
  strategy: [
    { block_type: "section_heading", block_data: { title: "Exam Strategy" } },
    { block_type: "rich_text", block_data: { markdown: "" } },
    { block_type: "tip", block_data: { text: "" } },
    { block_type: "summary", block_data: { items: [] } },
  ],
};

/** Empty starter block set for a new lesson, keyed by content_type. Falls back to a
 * minimal generic scaffold for types with no natural block-shape (review/mock_test/mixed/null). */
export function getLessonTemplateBlocks(contentType: string | null): TemplateBlock[] {
  if (!contentType) return GENERIC_SCAFFOLD;
  return TEMPLATES[contentType] ?? GENERIC_SCAFFOLD;
}
