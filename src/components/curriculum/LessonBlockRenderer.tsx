"use client";

import { useState } from "react";
import type { ResolvedBlock, LockedAfter } from "@/lib/curriculum/getLessonBlocks";
import { LockedBlockPlaceholder } from "@/components/curriculum/blocks/LockedBlockPlaceholder";
import { SectionCompleteButton } from "@/components/curriculum/SectionCompleteButton";
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
  KanjiRadicalsBlock,
  SimilarKanjiBlock,
  MemoryAidBlock,
  GrammarFormationBlock,
  NuanceBlock,
  RegisterBlock,
  WhenNotToUseBlock,
  CollocationsBlock,
  RelatedWordsBlock,
} from "@/components/curriculum/blocks/LanguageBlocks";
import { CheckpointBlock, ActionPlanBlock, WritingPromptBlock, ComprehensionQuestionBlock, SpeakingPromptBlock, WritingCanvasBlock } from "@/components/curriculum/blocks/InteractiveBlocks";
import {
  AudioBlock,
  PronunciationBlock,
  DialogueBlock,
  ReadingPassageBlock,
  ResourceLinkBlock,
  NextLessonBlock,
} from "@/components/curriculum/blocks/MediaBlocks";

export interface SectionProgressProps {
  ownerType: "lesson" | "post";
  ownerId: string;
  completedSectionIds: string[];
}

export function LessonBlockRenderer({
  blocks,
  lockedBoundary,
  progress,
}: {
  blocks: ResolvedBlock[];
  lockedBoundary?: LockedAfter | null;
  /** Enables the per-section "mark complete" button after each section's last block, and
   * auto-completion when a section-ending checkpoint is answered correctly. Omit for contexts
   * where section-level progress doesn't apply (writing composition, the vocab/grammar/kanji
   * rich-content tail) — blocks still render, just without the completion affordance. */
  progress?: SectionProgressProps;
}) {
  const [locallyCompleted, setLocallyCompleted] = useState<Set<string>>(new Set());

  async function markComplete(sectionBlockId: string, method: "manual" | "checkpoint_passed") {
    if (!progress) return;
    setLocallyCompleted((prev) => new Set(prev).add(sectionBlockId));
    await fetch("/api/learn/progress/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerType: progress.ownerType, ownerId: progress.ownerId, sectionBlockId, method }),
    }).catch(() => {});
  }

  // Index of each section_heading block — a section spans from one of these up to (not
  // including) the next, or to the end of the list for the last section.
  const sectionStartIndexes = blocks.map((b, i) => (b.blockType === "section_heading" ? i : -1)).filter((i) => i !== -1);

  function sectionIdForIndex(i: number): string | null {
    let id: string | null = null;
    for (const idx of sectionStartIndexes) {
      if (idx <= i) id = blocks[idx].id;
      else break;
    }
    return id;
  }

  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        const sectionId = progress ? sectionIdForIndex(i) : null;
        const isLastOfSection = sectionId != null && (i === blocks.length - 1 || blocks[i + 1].blockType === "section_heading");
        const isCompleted = sectionId != null && (locallyCompleted.has(sectionId) || progress!.completedSectionIds.includes(sectionId));

        return (
          <div key={block.id}>
            {renderBlock(block, isLastOfSection && sectionId != null ? () => markComplete(sectionId, "checkpoint_passed") : undefined)}
            {isLastOfSection && sectionId != null && (
              <div className="mt-3">
                <SectionCompleteButton completed={isCompleted} onComplete={() => markComplete(sectionId, "manual")} />
              </div>
            )}
          </div>
        );
      })}
      {lockedBoundary && <LockedBlockPlaceholder count={lockedBoundary.count} requiredAccess={lockedBoundary.requiredAccess} />}
    </div>
  );
}

function renderBlock(block: ResolvedBlock, onCheckpointCorrect?: () => void) {
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
    case "kanji_radicals":
      return <KanjiRadicalsBlock data={block.data as never} />;
    case "similar_kanji":
      return <SimilarKanjiBlock data={block.data as never} kanji={block.resolved.kanji ?? []} />;
    case "memory_aid":
      return <MemoryAidBlock data={block.data as never} />;
    case "grammar_formation":
      return <GrammarFormationBlock data={block.data as never} />;
    case "nuance":
      return <NuanceBlock data={block.data as never} />;
    case "register":
      return <RegisterBlock data={block.data as never} />;
    case "when_not_to_use":
      return <WhenNotToUseBlock data={block.data as never} />;
    case "collocations":
      return <CollocationsBlock data={block.data as never} />;
    case "related_words":
      return <RelatedWordsBlock data={block.data as never} />;
    case "example_set":
      return <ExampleSetBlock data={block.data as never} examples={block.resolved.examples ?? []} />;
    case "comparison":
      return <ComparisonBlock data={block.data as never} />;
    case "checkpoint":
      return <CheckpointBlock data={block.data as never} onCorrect={onCheckpointCorrect} />;
    case "action_plan":
      return <ActionPlanBlock data={block.data as never} />;
    case "writing_prompt":
      return <WritingPromptBlock data={block.data as never} />;
    case "writing_canvas":
      return <WritingCanvasBlock data={block.data as never} />;
    case "comprehension_question":
      return <ComprehensionQuestionBlock data={block.data as never} />;
    case "speaking_prompt":
      return <SpeakingPromptBlock data={block.data as never} />;
    case "audio":
      return <AudioBlock data={block.data as never} />;
    case "pronunciation":
      return <PronunciationBlock data={block.data as never} />;
    case "dialogue":
      return <DialogueBlock data={block.data as never} />;
    case "reading_passage":
      return <ReadingPassageBlock data={block.data as never} />;
    case "resource_link":
      return <ResourceLinkBlock data={block.data as never} />;
    case "next_lesson":
      return <NextLessonBlock data={block.data as never} lessons={block.resolved.lessons ?? []} />;
    default:
      return null;
  }
}
