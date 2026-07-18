/**
 * Official JLPT item-type taxonomy — the single source of truth for how mock-test questions are
 * tagged. Deliberately NOT enforced as a DB constraint (practice_test_questions.item_type stays
 * free text) — this drives an admin datalist (suggestion, not validation), the mock-test
 * generation script (always emits real tag values from here), and the public results screen's
 * accuracy-by-family breakdown. kanji_reading is the one entry whose `family` ("kanji") differs
 * from its `sectionType`'s natural family ("vocabulary") — that mismatch is what gives Kanji its
 * own results bucket, separate from Vocabulary, without any schema change.
 */

export type ItemFamily = "vocabulary" | "kanji" | "grammar" | "reading" | "listening";
export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type SectionType = "vocabulary" | "grammar" | "reading" | "listening";

export interface ItemTypeDef {
  /** Written verbatim into practice_test_questions.item_type. */
  value: string;
  /** Display label with the official Japanese term. */
  label: string;
  /** Results-bucket family — see kanji_reading note above. */
  family: ItemFamily;
  sectionType: SectionType;
  /** Which levels this item type is actually tested at. */
  levels: JlptLevel[];
  /** Short blurb shown as the in-test group header subtitle. */
  groupInstructions?: string;
}

const ALL_LEVELS: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];
const N3_TO_N1: JlptLevel[] = ["N3", "N2", "N1"];
const N2_N1: JlptLevel[] = ["N2", "N1"];

export const ITEM_TYPES: ItemTypeDef[] = [
  // --- Vocabulary family (section: vocabulary) ---
  {
    value: "kanji_reading",
    label: "Kanji Reading (漢字読み)",
    family: "kanji",
    sectionType: "vocabulary",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the correct reading for the underlined kanji.",
  },
  {
    value: "orthography",
    label: "Orthography (表記)",
    family: "vocabulary",
    sectionType: "vocabulary",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the correct kanji/word for the underlined word.",
  },
  {
    value: "context_meaning",
    label: "Context Meaning (文脈規定)",
    family: "vocabulary",
    sectionType: "vocabulary",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the word that best fits the context.",
  },
  {
    value: "paraphrase",
    label: "Paraphrase (言い換え類義)",
    family: "vocabulary",
    sectionType: "vocabulary",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the word/phrase closest in meaning to the underlined part.",
  },
  {
    value: "usage",
    label: "Usage (用法)",
    family: "vocabulary",
    sectionType: "vocabulary",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the sentence that uses the word correctly.",
  },
  {
    value: "word_formation",
    label: "Word Formation (語形成)",
    family: "vocabulary",
    sectionType: "vocabulary",
    levels: N2_N1,
    groupInstructions: "Choose the correct prefix/suffix or compound form.",
  },

  // --- Grammar family (section: grammar) ---
  {
    value: "grammar_form_selection",
    label: "Grammar Form Selection (文の文法1)",
    family: "grammar",
    sectionType: "grammar",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the grammar form that best fits the blank.",
  },
  {
    value: "sentence_composition",
    label: "Sentence Composition (文の文法2)",
    family: "grammar",
    sectionType: "grammar",
    levels: ALL_LEVELS,
    groupInstructions: "Arrange the words to form a correct, natural sentence.",
  },
  {
    value: "text_grammar",
    label: "Text Grammar (文章の文法)",
    family: "grammar",
    sectionType: "grammar",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the best word/expression for each blank in the passage.",
  },

  // --- Reading family (section: reading) ---
  {
    value: "short_passage",
    label: "Short Passage (内容理解-短文)",
    family: "reading",
    sectionType: "reading",
    levels: ALL_LEVELS,
    groupInstructions: "Read the passage and answer the question about its content.",
  },
  {
    value: "mid_passage",
    label: "Mid-size Passage (内容理解-中文)",
    family: "reading",
    sectionType: "reading",
    levels: ALL_LEVELS,
    groupInstructions: "Read the passage and answer the questions about its content.",
  },
  {
    value: "long_passage",
    label: "Long Passage (内容理解-長文)",
    family: "reading",
    sectionType: "reading",
    levels: N3_TO_N1,
    groupInstructions: "Read the passage and answer the questions about its content.",
  },
  {
    value: "integrated_comprehension_reading",
    label: "Integrated Comprehension (統合理解)",
    family: "reading",
    sectionType: "reading",
    levels: N2_N1,
    groupInstructions: "Read multiple related passages and answer by comparing them.",
  },
  {
    value: "thematic_comprehension",
    label: "Thematic Comprehension (主張理解)",
    family: "reading",
    sectionType: "reading",
    levels: N2_N1,
    groupInstructions: "Read the passage and identify the writer's main claim/opinion.",
  },
  {
    value: "information_retrieval",
    label: "Information Retrieval (情報検索)",
    family: "reading",
    sectionType: "reading",
    levels: ALL_LEVELS,
    groupInstructions: "Find the requested information in the given material (e.g. a notice or listing).",
  },

  // --- Listening family (section: listening) ---
  {
    value: "task_based",
    label: "Task-based (課題理解)",
    family: "listening",
    sectionType: "listening",
    levels: ALL_LEVELS,
    groupInstructions: "Listen and choose what the person should do next.",
  },
  {
    value: "key_points",
    label: "Key Points (ポイント理解)",
    family: "listening",
    sectionType: "listening",
    levels: ALL_LEVELS,
    groupInstructions: "Listen and choose the answer that matches the key point.",
  },
  {
    value: "general_outline",
    label: "General Outline (概要理解)",
    family: "listening",
    sectionType: "listening",
    levels: N3_TO_N1,
    groupInstructions: "Listen and choose the answer that matches the speaker's overall point.",
  },
  {
    value: "verbal_expressions",
    label: "Verbal Expressions (発話表現)",
    family: "listening",
    sectionType: "listening",
    levels: ALL_LEVELS,
    groupInstructions: "Choose the most natural thing to say in the given situation.",
  },
  {
    value: "quick_response",
    label: "Quick Response (即時応答)",
    family: "listening",
    sectionType: "listening",
    levels: ALL_LEVELS,
    groupInstructions: "Listen to the short utterance and choose the best response.",
  },
  {
    value: "integrated_comprehension_listening",
    label: "Integrated Comprehension (統合理解)",
    family: "listening",
    sectionType: "listening",
    levels: N2_N1,
    groupInstructions: "Listen to the full conversation, then answer by comparing multiple viewpoints.",
  },
];

const ITEM_TYPES_BY_VALUE = new Map(ITEM_TYPES.map((t) => [t.value, t]));

export function familyForItemType(itemType: string | null | undefined): ItemFamily | null {
  if (!itemType) return null;
  return ITEM_TYPES_BY_VALUE.get(itemType)?.family ?? null;
}

export function labelForItemType(itemType: string | null | undefined): string {
  if (!itemType) return "";
  return ITEM_TYPES_BY_VALUE.get(itemType)?.label ?? itemType;
}

export function getItemTypeDef(itemType: string | null | undefined): ItemTypeDef | undefined {
  if (!itemType) return undefined;
  return ITEM_TYPES_BY_VALUE.get(itemType);
}

export function itemTypesForSection(sectionType: string, level?: JlptLevel): ItemTypeDef[] {
  return ITEM_TYPES.filter(
    (t) => t.sectionType === sectionType && (!level || t.levels.includes(level))
  );
}

export const ITEM_FAMILY_LABELS: Record<ItemFamily, string> = {
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
};

/** Where a "practice more" link for a weak family should point — kanji gets its own catalog
 * page, distinct from vocabulary, even though kanji_reading items live in a vocabulary section. */
export const ITEM_FAMILY_LEARN_PATH: Record<ItemFamily, string> = {
  vocabulary: "/learn/vocabulary",
  kanji: "/learn/kanji",
  grammar: "/learn/grammar",
  reading: "/learn/reading",
  listening: "/learn/listening",
};
