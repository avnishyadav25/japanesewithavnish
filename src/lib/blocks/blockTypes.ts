/**
 * Structured lesson content blocks (Phase 1 of the Curriculum CMS redesign).
 * Reference-based blocks (VocabularySet/GrammarRule/KanjiFocus/KanaGrid) store IDs into the
 * existing vocabulary/grammar/kanji/kana tables rather than duplicating Japanese text —
 * reuses the FK linking architecture that already exists via curriculum_lesson_vocabulary etc.
 */

export type BlockType =
  | "section_heading"
  | "rich_text"
  | "japanese_learning_text"
  | "kana_character"
  | "kana_grid"
  | "vocabulary_set"
  | "grammar_rule"
  | "kanji_focus"
  | "example_set"
  | "pronunciation"
  | "audio"
  | "dialogue"
  | "reading_passage"
  | "common_mistake"
  | "culture_note"
  | "tip"
  | "comparison"
  | "checkpoint"
  | "summary"
  | "action_plan"
  | "speaking_prompt"
  | "comprehension_question"
  | "writing_prompt"
  | "kanji_radicals"
  | "similar_kanji"
  | "memory_aid"
  | "grammar_formation"
  | "nuance"
  | "register"
  | "when_not_to_use"
  | "collocations"
  | "related_words"
  | "writing_canvas"
  | "resource_link"
  | "next_lesson";

export interface SectionHeadingData {
  title: string;
  subtitle?: string;
  anchorId?: string;
}

export interface RichTextData {
  // Markdown, rendered through the same interactive pipeline as the legacy lesson body
  // (LearnMarkdown: TTS buttons, writing-practice modal, callout boxes) — not static HTML.
  markdown: string;
}

export interface JapaneseLearningTextData {
  japanese: string;
  furigana?: string;
  romaji?: string;
  meaning: string;
  audioUrl?: string;
  notes?: string;
  showFurigana?: boolean;
  showRomaji?: boolean;
}

export interface KanaCharacterData {
  kanaIds: string[]; // FK into `kana` table
  showMnemonic?: boolean;
  showStrokeOrder?: boolean;
}

export interface KanaGridData {
  kanaIds: string[]; // FK into `kana` table
  showRomaji?: boolean;
  showAudio?: boolean;
  enablePracticeMode?: boolean;
}

export interface VocabularySetData {
  vocabularyIds: string[]; // FK into `vocabulary` table
  showRomaji?: boolean;
  showMeaning?: boolean;
  showExample?: boolean;
  enableAudio?: boolean;
  enableFlashcards?: boolean;
  randomize?: boolean;
}

export interface GrammarRuleData {
  grammarIds: string[]; // FK into `grammar` table
}

export interface KanjiFocusData {
  kanjiIds: string[]; // FK into `kanji` table
  showRareMeanings?: boolean;
}

export interface ExampleSetData {
  exampleIds: string[]; // FK into `examples` table
  hideRomaji?: boolean;
}

export interface PronunciationData {
  targetSound: string;
  commonMistake?: string;
  correctGuidance: string;
  audioSlowUrl?: string;
  audioNormalUrl?: string;
  mouthGuidanceUrl?: string;
}

export interface AudioData {
  audioUrl: string;
  transcript?: string;
  furiganaTranscript?: string;
  romajiTranscript?: string;
  translation?: string;
  durationSeconds?: number;
  loop?: boolean;
}

export interface DialogueLine {
  speaker: string;
  japanese: string;
  furigana?: string;
  romaji?: string;
  translation?: string;
  audioUrl?: string;
}

export interface DialogueData {
  lines: DialogueLine[];
}

export interface ReadingPassageAnnotation {
  start: number;
  end: number;
  kind: "vocab" | "grammar" | "kanji" | "connector" | "reference";
  note?: string;
  refId?: string;
}

export interface ReadingPassageData {
  title: string;
  passage: string;
  furiganaVersion?: string;
  plainVersion?: string;
  annotations?: ReadingPassageAnnotation[];
  furiganaMode?: "off" | "hover" | "always";
  translation?: string;
  estimatedReadingMinutes?: number;
}

export interface ComprehensionQuestionChoice {
  text: string;
  isCorrect: boolean;
}

export interface ComprehensionQuestionData {
  question: string;
  choices: ComprehensionQuestionChoice[];
  skill: "main_idea" | "detail" | "inference" | "writer_intention" | "paraphrase";
  explanation?: string;
}

export interface CommonMistakeData {
  text: string;
}

export interface CultureNoteData {
  text: string;
}

export interface TipData {
  text: string;
}

export interface ComparisonRow {
  pattern: string;
  meaning: string;
  usage: string;
}

export interface ComparisonData {
  rows: ComparisonRow[];
}

export interface CheckpointOption {
  text: string;
  isCorrect: boolean;
}

export interface CheckpointData {
  question: string;
  options: CheckpointOption[];
}

export interface SummaryData {
  items: string[];
}

export interface ActionPlanData {
  today?: string;
  tomorrow?: string;
  thisWeek?: string;
}

export interface SpeakingPromptData {
  promptJapanese: string;
  promptEnglish?: string;
  recordEnabled?: boolean;
  modelAnswerAudioUrl?: string;
  feedbackRubric?: string[];
}

export interface WritingPromptData {
  prompt: string;
  expectedLength?: string;
  targetGrammar?: string[];
  targetVocabulary?: string[];
  checklist?: string[];
}


export interface KanjiRadical {
  character: string;
  meaning: string;
  strokeCount?: number;
}

export interface KanjiRadicalsData {
  radicals: KanjiRadical[];
}

export interface SimilarKanjiData {
  similarKanjiIds: string[]; // FK into `kanji` table — other, visually confusable characters
  note?: string;
}

export interface MemoryAidData {
  // Renderer must show this as explicitly a mnemonic, not an etymological/historical claim.
  text: string;
}

export interface GrammarFormationVariant {
  label: string; // e.g. "Present affirmative", "Past negative"
  form: string;
  example?: string;
}

export interface GrammarFormationData {
  variants: GrammarFormationVariant[];
}

export interface NuanceData {
  text: string;
}

export interface RegisterData {
  text: string;
}

export interface WhenNotToUseData {
  text: string;
}

export interface CollocationItem {
  phrase: string;
  translation?: string;
}

export interface CollocationsData {
  items: CollocationItem[];
}

export interface RelatedWordsData {
  synonyms?: string[];
  antonyms?: string[];
  wordFamily?: string[];
}

export interface WritingCanvasCharacterRef {
  character: string;
  characterType: "kanji" | "hiragana" | "katakana";
  reading?: string;
  meaning?: string;
}

export interface WritingCanvasData {
  // Wraps the existing WritingCanvas/WritingPracticeModal components inline — literal character
  // list, not an FK array, matching how kanji_radicals/grammar_formation embed literal data.
  instructions?: string;
  characters: WritingCanvasCharacterRef[];
}

export interface ResourceLinkData {
  title: string;
  url: string;
  resourceType: "article" | "video" | "audio" | "tool" | "pdf" | "other";
  description?: string;
}

export interface NextLessonData {
  lessonId: string; // FK into curriculum_lessons
  note?: string;
}

export type BlockDataMap = {
  section_heading: SectionHeadingData;
  rich_text: RichTextData;
  japanese_learning_text: JapaneseLearningTextData;
  kana_character: KanaCharacterData;
  kana_grid: KanaGridData;
  vocabulary_set: VocabularySetData;
  grammar_rule: GrammarRuleData;
  kanji_focus: KanjiFocusData;
  example_set: ExampleSetData;
  pronunciation: PronunciationData;
  audio: AudioData;
  dialogue: DialogueData;
  reading_passage: ReadingPassageData;
  common_mistake: CommonMistakeData;
  culture_note: CultureNoteData;
  tip: TipData;
  comparison: ComparisonData;
  checkpoint: CheckpointData;
  summary: SummaryData;
  action_plan: ActionPlanData;
  speaking_prompt: SpeakingPromptData;
  comprehension_question: ComprehensionQuestionData;
  writing_prompt: WritingPromptData;
  kanji_radicals: KanjiRadicalsData;
  similar_kanji: SimilarKanjiData;
  memory_aid: MemoryAidData;
  grammar_formation: GrammarFormationData;
  nuance: NuanceData;
  register: RegisterData;
  when_not_to_use: WhenNotToUseData;
  collocations: CollocationsData;
  related_words: RelatedWordsData;
  writing_canvas: WritingCanvasData;
  resource_link: ResourceLinkData;
  next_lesson: NextLessonData;
};

export interface LessonBlock<T extends BlockType = BlockType> {
  id: string;
  lessonId: string;
  blockType: T;
  blockData: BlockDataMap[T];
  sortOrder: number;
  status: "draft" | "published";
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  section_heading: "Section Heading",
  rich_text: "Rich Text",
  japanese_learning_text: "Japanese Learning Text",
  kana_character: "Kana Character",
  kana_grid: "Kana Grid",
  vocabulary_set: "Vocabulary Set",
  grammar_rule: "Grammar Rule",
  kanji_focus: "Kanji Focus",
  example_set: "Example Set",
  pronunciation: "Pronunciation",
  audio: "Audio",
  dialogue: "Dialogue",
  reading_passage: "Reading Passage",
  common_mistake: "Common Mistake",
  culture_note: "Culture Note",
  tip: "Tip",
  comparison: "Comparison",
  checkpoint: "Checkpoint",
  summary: "Summary",
  action_plan: "Action Plan",
  speaking_prompt: "Speaking Prompt",
  comprehension_question: "Comprehension Question",
  writing_prompt: "Writing Prompt",
  kanji_radicals: "Kanji Radicals",
  similar_kanji: "Similar Kanji",
  memory_aid: "Memory Aid",
  grammar_formation: "Grammar Formation",
  nuance: "Nuance",
  register: "Register",
  when_not_to_use: "When Not To Use",
  collocations: "Collocations",
  related_words: "Related Words",
  writing_canvas: "Writing Canvas",
  resource_link: "Resource Link",
  next_lesson: "Next Lesson",
};

export const BLOCK_TYPE_CATEGORIES: Record<string, BlockType[]> = {
  Text: ["section_heading", "rich_text", "summary", "tip", "culture_note", "common_mistake"],
  "Language Items": ["japanese_learning_text", "kana_character", "kana_grid", "vocabulary_set", "grammar_rule", "kanji_focus", "example_set", "comparison"],
  "Practice / Interactive": ["checkpoint", "action_plan", "speaking_prompt", "comprehension_question", "writing_prompt", "writing_canvas"],
  "Kanji Enrichment": ["kanji_radicals", "similar_kanji", "memory_aid"],
  "Grammar Enrichment": ["grammar_formation", "nuance", "register", "when_not_to_use"],
  "Vocabulary Enrichment": ["collocations", "related_words"],
  Media: ["audio", "pronunciation", "dialogue", "reading_passage"],
  Navigation: ["resource_link", "next_lesson"],
};

export const ALL_BLOCK_TYPES: BlockType[] = Object.keys(BLOCK_TYPE_LABELS) as BlockType[];

/** Lightweight runtime validation — returns a list of problems, empty if valid. */
export function validateBlockData(blockType: BlockType, data: unknown): string[] {
  const errors: string[] = [];
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const isNonEmptyString = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const isStringArray = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

  switch (blockType) {
    case "section_heading":
      if (!isNonEmptyString(d.title)) errors.push("title is required");
      break;
    case "rich_text":
      if (!isNonEmptyString(d.markdown)) errors.push("markdown is required");
      break;
    case "japanese_learning_text":
      if (!isNonEmptyString(d.japanese)) errors.push("japanese is required");
      if (!isNonEmptyString(d.meaning)) errors.push("meaning is required");
      break;
    case "kana_character":
    case "kana_grid":
      if (!isStringArray(d.kanaIds) || (d.kanaIds as string[]).length === 0) errors.push("kanaIds must be a non-empty array");
      break;
    case "vocabulary_set":
      if (!isStringArray(d.vocabularyIds) || (d.vocabularyIds as string[]).length === 0) errors.push("vocabularyIds must be a non-empty array");
      break;
    case "grammar_rule":
      if (!isStringArray(d.grammarIds) || (d.grammarIds as string[]).length === 0) errors.push("grammarIds must be a non-empty array");
      break;
    case "kanji_focus":
      if (!isStringArray(d.kanjiIds) || (d.kanjiIds as string[]).length === 0) errors.push("kanjiIds must be a non-empty array");
      break;
    case "example_set":
      if (!isStringArray(d.exampleIds) || (d.exampleIds as string[]).length === 0) errors.push("exampleIds must be a non-empty array");
      break;
    case "pronunciation":
      if (!isNonEmptyString(d.targetSound)) errors.push("targetSound is required");
      if (!isNonEmptyString(d.correctGuidance)) errors.push("correctGuidance is required");
      break;
    case "audio":
      if (!isNonEmptyString(d.audioUrl)) errors.push("audioUrl is required");
      break;
    case "dialogue":
      if (!Array.isArray(d.lines) || d.lines.length === 0) errors.push("lines must be a non-empty array");
      break;
    case "reading_passage":
      if (!isNonEmptyString(d.title)) errors.push("title is required");
      if (!isNonEmptyString(d.passage)) errors.push("passage is required");
      break;
    case "common_mistake":
    case "culture_note":
    case "tip":
      if (!isNonEmptyString(d.text)) errors.push("text is required");
      break;
    case "comparison":
      if (!Array.isArray(d.rows) || d.rows.length === 0) errors.push("rows must be a non-empty array");
      break;
    case "checkpoint":
      if (!isNonEmptyString(d.question)) errors.push("question is required");
      if (!Array.isArray(d.options) || d.options.length < 2) errors.push("options must have at least 2 items");
      else if (!(d.options as CheckpointOption[]).some((o) => o.isCorrect)) errors.push("at least one option must be marked correct");
      break;
    case "summary":
      if (!isStringArray(d.items) || (d.items as string[]).length === 0) errors.push("items must be a non-empty array");
      break;
    case "action_plan":
      if (!d.today && !d.tomorrow && !d.thisWeek) errors.push("at least one of today/tomorrow/thisWeek is required");
      break;
    case "speaking_prompt":
      if (!isNonEmptyString(d.promptJapanese)) errors.push("promptJapanese is required");
      break;
    case "comprehension_question": {
      if (!isNonEmptyString(d.question)) errors.push("question is required");
      const choices = d.choices as ComprehensionQuestionChoice[] | undefined;
      if (!Array.isArray(choices) || choices.length < 2) errors.push("choices must have at least 2 items");
      else if (!choices.some((c) => c.isCorrect)) errors.push("at least one choice must be marked correct");
      const validSkills = ["main_idea", "detail", "inference", "writer_intention", "paraphrase"];
      if (!validSkills.includes(d.skill as string)) errors.push("skill must be a valid comprehension skill tag");
      break;
    }
    case "writing_prompt":
      if (!isNonEmptyString(d.prompt)) errors.push("prompt is required");
      break;
    case "kanji_radicals":
      if (!Array.isArray(d.radicals) || d.radicals.length === 0) errors.push("radicals must be a non-empty array");
      break;
    case "similar_kanji":
      if (!isStringArray(d.similarKanjiIds) || (d.similarKanjiIds as string[]).length === 0) errors.push("similarKanjiIds must be a non-empty array");
      break;
    case "memory_aid":
      if (!isNonEmptyString(d.text)) errors.push("text is required");
      break;
    case "grammar_formation":
      if (!Array.isArray(d.variants) || d.variants.length === 0) errors.push("variants must be a non-empty array");
      break;
    case "nuance":
    case "register":
    case "when_not_to_use":
      if (!isNonEmptyString(d.text)) errors.push("text is required");
      break;
    case "collocations":
      if (!Array.isArray(d.items) || d.items.length === 0) errors.push("items must be a non-empty array");
      break;
    case "related_words":
      if (!(d.synonyms as unknown[] | undefined)?.length && !(d.antonyms as unknown[] | undefined)?.length && !(d.wordFamily as unknown[] | undefined)?.length) {
        errors.push("at least one of synonyms/antonyms/wordFamily is required");
      }
      break;
    case "writing_canvas":
      if (!Array.isArray(d.characters) || d.characters.length === 0) errors.push("characters must be a non-empty array");
      break;
    case "resource_link": {
      if (!isNonEmptyString(d.title)) errors.push("title is required");
      if (!isNonEmptyString(d.url)) errors.push("url is required");
      const validResourceTypes = ["article", "video", "audio", "tool", "pdf", "other"];
      if (!validResourceTypes.includes(d.resourceType as string)) errors.push("resourceType must be a valid resource type");
      break;
    }
    case "next_lesson":
      if (!isNonEmptyString(d.lessonId)) errors.push("lessonId is required");
      break;
    default:
      errors.push(`unknown block type: ${blockType}`);
  }
  return errors;
}
