"use client";

import { useState } from "react";
import type { CheckpointData, ActionPlanData, WritingPromptData, ComprehensionQuestionData, SpeakingPromptData, WritingCanvasData } from "@/lib/blocks/blockTypes";
import { WritingPracticeModal } from "@/components/learn/WritingPracticeModal";
import { EmptyBlockState } from "./BlockStates";

const COMPREHENSION_SKILL_LABELS: Record<ComprehensionQuestionData["skill"], string> = {
  main_idea: "Main idea",
  detail: "Detail",
  inference: "Inference",
  writer_intention: "Writer's intention",
  paraphrase: "Paraphrase",
};

export function ComprehensionQuestionBlock({ data }: { data: ComprehensionQuestionData }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!data.choices || data.choices.length === 0) return <EmptyBlockState label="This comprehension question has no answer choices." />;
  return (
    <div className="bg-white border border-primary/20 rounded-bento p-5">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-bold text-primary uppercase tracking-wider">Comprehension Check</p>
        <span className="text-[10px] text-secondary bg-[var(--base)] border border-[var(--divider)] rounded-full px-2 py-0.5">
          {COMPREHENSION_SKILL_LABELS[data.skill] ?? data.skill}
        </span>
      </div>
      <p className="text-charcoal text-sm font-semibold mb-3">{data.question}</p>
      <div className="space-y-2">
        {data.choices.map((choice, i) => {
          const isSelected = selected === i;
          const showResult = selected !== null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition ${
                showResult && isSelected
                  ? choice.isCorrect
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : "border-red-400 bg-red-50 text-red-900"
                  : "border-[var(--divider)] hover:border-primary/40 text-charcoal"
              }`}
            >
              {choice.text}
            </button>
          );
        })}
      </div>
      {selected !== null && data.explanation && (
        <p className="text-secondary text-xs mt-3 pt-3 border-t border-[var(--divider)]">{data.explanation}</p>
      )}
    </div>
  );
}

export function SpeakingPromptBlock({ data }: { data: SpeakingPromptData }) {
  return (
    <div className="bg-white border border-primary/20 rounded-bento p-5 space-y-3">
      <p className="text-xs font-bold text-primary uppercase tracking-wider">Speaking Practice</p>
      <p className="text-charcoal text-lg">{data.promptJapanese}</p>
      {data.promptEnglish && <p className="text-secondary text-sm">{data.promptEnglish}</p>}
      {data.modelAnswerAudioUrl && (
        <audio controls src={data.modelAnswerAudioUrl} className="w-full">
          Your browser does not support audio playback.
        </audio>
      )}
      {data.feedbackRubric && data.feedbackRubric.length > 0 && (
        <ul className="space-y-1">
          {data.feedbackRubric.map((item, i) => (
            <li key={i} className="text-sm text-secondary flex gap-2">
              <span className="text-primary font-bold">☐</span>
              {item}
            </li>
          ))}
        </ul>
      )}
      {data.recordEnabled && (
        <p className="text-xs text-secondary italic">Practice saying this out loud, then compare against the model answer above.</p>
      )}
    </div>
  );
}

export function CheckpointBlock({ data, onCorrect }: { data: CheckpointData; onCorrect?: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!data.options || data.options.length === 0) return <EmptyBlockState label="This checkpoint has no options." />;
  return (
    <div className="bg-white border border-primary/20 rounded-bento p-5">
      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Checkpoint</p>
      <p className="text-charcoal text-sm font-semibold mb-3">{data.question}</p>
      <div className="space-y-2">
        {data.options.map((opt, i) => {
          const isSelected = selected === i;
          const showResult = selected !== null;
          const isRight = opt.isCorrect;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSelected(i);
                if (opt.isCorrect) onCorrect?.();
              }}
              className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition ${
                showResult && isSelected
                  ? isRight
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : "border-red-400 bg-red-50 text-red-900"
                  : "border-[var(--divider)] hover:border-primary/40 text-charcoal"
              }`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WritingPromptBlock({ data }: { data: WritingPromptData }) {
  return (
    <div className="bg-white border border-primary/20 rounded-bento p-5 space-y-3">
      <p className="text-xs font-bold text-primary uppercase tracking-wider">Writing Prompt</p>
      <p className="text-charcoal text-sm whitespace-pre-wrap">{data.prompt}</p>
      {data.expectedLength && (
        <p className="text-secondary text-xs">
          <span className="font-semibold">Expected length: </span>
          {data.expectedLength}
        </p>
      )}
      {data.targetGrammar && data.targetGrammar.length > 0 && (
        <p className="text-secondary text-xs">
          <span className="font-semibold">Target grammar: </span>
          {data.targetGrammar.join(", ")}
        </p>
      )}
      {data.targetVocabulary && data.targetVocabulary.length > 0 && (
        <p className="text-secondary text-xs">
          <span className="font-semibold">Target vocabulary: </span>
          {data.targetVocabulary.join(", ")}
        </p>
      )}
      {data.checklist && data.checklist.length > 0 && (
        <ul className="space-y-1">
          {data.checklist.map((item, i) => (
            <li key={i} className="text-sm text-secondary flex gap-2">
              <span className="text-primary font-bold">☐</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WritingCanvasBlock({ data }: { data: WritingCanvasData }) {
  const [practiceChar, setPracticeChar] = useState<WritingCanvasData["characters"][number] | null>(null);
  if (!data.characters || data.characters.length === 0) return <EmptyBlockState label="No characters to practice in this block." />;
  return (
    <div className="bg-white border border-primary/20 rounded-bento p-5 space-y-3">
      <p className="text-xs font-bold text-primary uppercase tracking-wider">Writing Practice</p>
      {data.instructions && <p className="text-charcoal text-sm">{data.instructions}</p>}
      <div className="flex flex-wrap gap-2">
        {data.characters.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPracticeChar(c)}
            className="flex flex-col items-center gap-1 bg-[#FAF8F5] border border-[var(--divider)] rounded-xl px-4 py-3 hover:border-primary/40 transition"
            title="Practice this character"
          >
            <span className="text-2xl font-bold text-charcoal">{c.character}</span>
            {c.reading && <span className="text-[10px] text-secondary font-mono">{c.reading}</span>}
          </button>
        ))}
      </div>
      {practiceChar && (
        <WritingPracticeModal
          character={practiceChar.character}
          characterType={practiceChar.characterType}
          reading={practiceChar.reading}
          meaning={practiceChar.meaning}
          isOpen={!!practiceChar}
          onClose={() => setPracticeChar(null)}
        />
      )}
    </div>
  );
}

export function ActionPlanBlock({ data }: { data: ActionPlanData }) {
  const rows = [
    { label: "Today", value: data.today },
    { label: "Tomorrow", value: data.tomorrow },
    { label: "This week", value: data.thisWeek },
  ].filter((r) => r.value);
  if (rows.length === 0) return null;
  return (
    <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-bento p-5 space-y-2">
      <h3 className="font-heading font-bold text-sm text-charcoal mb-1">Action Plan</h3>
      {rows.map((r) => (
        <p key={r.label} className="text-sm">
          <span className="font-semibold text-charcoal">{r.label}: </span>
          <span className="text-secondary">{r.value}</span>
        </p>
      ))}
    </div>
  );
}
