import type { ResolvedBlock } from "@/lib/curriculum/getLessonBlocks";
import {
  SectionHeadingBlock,
  RichTextBlock,
  SummaryBlock,
  TipBlock,
  CultureNoteBlock,
  CommonMistakeBlock,
} from "@/components/curriculum/blocks/TextBlocks";
import {
  JapaneseLearningTextBlock,
  KanaCharacterBlock,
  KanaGridBlock,
  VocabularySetBlock,
  GrammarRuleBlock,
  KanjiFocusBlock,
  ExampleSetBlock,
  ComparisonBlock,
} from "@/components/curriculum/blocks/LanguageBlocks";
import { CheckpointBlock, ActionPlanBlock } from "@/components/curriculum/blocks/InteractiveBlocks";
import {
  AudioBlock,
  PronunciationBlock,
  DialogueBlock,
  ReadingPassageBlock,
} from "@/components/curriculum/blocks/MediaBlocks";

export function LessonBlockRenderer({ blocks }: { blocks: ResolvedBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <div key={block.id}>{renderBlock(block)}</div>
      ))}
    </div>
  );
}

function renderBlock(block: ResolvedBlock) {
  switch (block.blockType) {
    case "section_heading":
      return <SectionHeadingBlock data={block.data as never} />;
    case "rich_text":
      return <RichTextBlock data={block.data as never} />;
    case "summary":
      return <SummaryBlock data={block.data as never} />;
    case "tip":
      return <TipBlock data={block.data as never} />;
    case "culture_note":
      return <CultureNoteBlock data={block.data as never} />;
    case "common_mistake":
      return <CommonMistakeBlock data={block.data as never} />;
    case "japanese_learning_text":
      return <JapaneseLearningTextBlock data={block.data as never} />;
    case "kana_character":
      return <KanaCharacterBlock data={block.data as never} kana={block.resolved.kana ?? []} />;
    case "kana_grid":
      return <KanaGridBlock data={block.data as never} kana={block.resolved.kana ?? []} />;
    case "vocabulary_set":
      return <VocabularySetBlock data={block.data as never} vocabulary={block.resolved.vocabulary ?? []} />;
    case "grammar_rule":
      return <GrammarRuleBlock data={block.data as never} grammar={block.resolved.grammar ?? []} />;
    case "kanji_focus":
      return <KanjiFocusBlock data={block.data as never} kanji={block.resolved.kanji ?? []} />;
    case "example_set":
      return <ExampleSetBlock data={block.data as never} examples={block.resolved.examples ?? []} />;
    case "comparison":
      return <ComparisonBlock data={block.data as never} />;
    case "checkpoint":
      return <CheckpointBlock data={block.data as never} />;
    case "action_plan":
      return <ActionPlanBlock data={block.data as never} />;
    case "audio":
      return <AudioBlock data={block.data as never} />;
    case "pronunciation":
      return <PronunciationBlock data={block.data as never} />;
    case "dialogue":
      return <DialogueBlock data={block.data as never} />;
    case "reading_passage":
      return <ReadingPassageBlock data={block.data as never} />;
    default:
      return null;
  }
}
