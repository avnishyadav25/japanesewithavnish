"use client";

import { useEffect, useState } from "react";
import { itemTypesForSection } from "@/lib/practiceTest/itemTypes";
import { GenerateMockTestModal } from "@/components/admin/GenerateMockTestModal";

/**
 * Admin builder for the real Practice Test system (sections + scored questions),
 * replacing the old PDF/audio-link-only editor. Sibling in spirit to
 * ContentBlocksSection.tsx but a different data shape (nested sections→questions
 * with correct-answer scoring, not a flat block list) so it gets its own component
 * and its own API (/api/admin/practice-tests/[postId]/...) rather than reusing blocks.
 */

type Question = {
  id: string;
  section_id: string;
  question_text: string;
  item_type: string | null;
  options: string[];
  correct_index: number;
  explanation: string | null;
  audio_url: string | null;
  sort_order: number;
};

type Section = {
  id: string;
  practice_test_id: string;
  title: string;
  section_type: "vocabulary" | "grammar" | "reading" | "listening";
  time_limit_minutes: number | null;
  passage: string | null;
  audio_url: string | null;
  sort_order: number;
  questions: Question[];
};

const SECTION_TYPE_LABELS: Record<Section["section_type"], string> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
};

export function PracticeTestBuilder({ postId, jlptLevel }: { postId: string; jlptLevel?: string | null }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [testExists, setTestExists] = useState(true);
  const [newSectionType, setNewSectionType] = useState<Section["section_type"]>("vocabulary");
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/practice-tests/${postId}`);
      const data = await res.json();
      setTestExists(Boolean(data.test));
      setSections(Array.isArray(data.sections) ? data.sections : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function addSection() {
    const res = await fetch(`/api/admin/practice-tests/${postId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `New ${SECTION_TYPE_LABELS[newSectionType]} section`, section_type: newSectionType }),
    });
    if (res.ok) await load();
  }

  async function updateSection(section: Section, patch: Partial<Section>) {
    const next = { ...section, ...patch };
    setSections((prev) => prev.map((s) => (s.id === section.id ? next : s)));
    await fetch(`/api/admin/practice-tests/${postId}/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteSection(sectionId: string) {
    if (!confirm("Delete this section and all its questions?")) return;
    await fetch(`/api/admin/practice-tests/${postId}/sections/${sectionId}`, { method: "DELETE" });
    await load();
  }

  async function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSections(reordered);
    await Promise.all(
      reordered.map((s, i) =>
        fetch(`/api/admin/practice-tests/${postId}/sections/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: (i + 1) * 10 }),
        })
      )
    );
  }

  async function addQuestion(section: Section) {
    const res = await fetch(`/api/admin/practice-tests/${postId}/sections/${section.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_text: "New question", options: ["", "", "", ""], correct_index: 0 }),
    });
    if (res.ok) await load();
  }

  async function updateQuestion(section: Section, question: Question, patch: Partial<Question>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== section.id ? s : { ...s, questions: s.questions.map((q) => (q.id === question.id ? { ...q, ...patch } : q)) }
      )
    );
    await fetch(`/api/admin/practice-tests/${postId}/sections/${section.id}/questions/${question.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteQuestion(section: Section, questionId: string) {
    if (!confirm("Delete this question?")) return;
    await fetch(`/api/admin/practice-tests/${postId}/sections/${section.id}/questions/${questionId}`, { method: "DELETE" });
    await load();
  }

  if (!testExists && !loading) {
    return <p className="text-xs text-secondary italic">Save once above to build sections.</p>;
  }

  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-secondary">Loading…</p>}

      <button
        type="button"
        onClick={() => setShowGenerateModal(true)}
        className="w-full py-2.5 text-sm font-bold rounded-bento border border-primary/30 text-primary hover:bg-primary/5 transition"
      >
        ✨ Generate more sections with AI
      </button>

      {sections.map((section, i) => (
        <div key={section.id} className="border border-[var(--divider)] rounded-bento overflow-hidden bg-white">
          <div className="bg-[var(--base)] px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" disabled={i === 0} onClick={() => moveSection(i, -1)} className="text-secondary hover:text-charcoal disabled:opacity-30 text-xs leading-none">▲</button>
                <button type="button" disabled={i === sections.length - 1} onClick={() => moveSection(i, 1)} className="text-secondary hover:text-charcoal disabled:opacity-30 text-xs leading-none">▼</button>
              </div>
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateSection(section, { title: e.target.value })}
                className="flex-1 px-3 py-1.5 border border-[var(--divider)] rounded-bento text-sm font-medium bg-white"
              />
              <select
                value={section.section_type}
                onChange={(e) => updateSection(section, { section_type: e.target.value as Section["section_type"] })}
                className="px-2 py-1.5 border border-[var(--divider)] rounded-bento text-sm bg-white"
              >
                {Object.entries(SECTION_TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <input
                type="number"
                value={section.time_limit_minutes ?? ""}
                onChange={(e) => updateSection(section, { time_limit_minutes: e.target.value ? parseInt(e.target.value, 10) : null })}
                placeholder="Time (min)"
                className="w-28 px-2 py-1.5 border border-[var(--divider)] rounded-bento text-sm bg-white"
              />
              <button type="button" onClick={() => deleteSection(section.id)} className="text-red-600 hover:underline text-xs shrink-0">Delete</button>
            </div>

            {(section.section_type === "reading" || section.section_type === "grammar") && (
              <textarea
                value={section.passage ?? ""}
                onChange={(e) => updateSection(section, { passage: e.target.value || null })}
                placeholder={
                  section.section_type === "grammar"
                    ? "Shared cloze passage (Japanese) for text_grammar questions in this section — leave blank if this section has no text_grammar items"
                    : "Shared reading passage (Japanese) for this section's questions"
                }
                rows={4}
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white"
              />
            )}
            {section.section_type === "listening" && (
              <input
                type="text"
                value={section.audio_url ?? ""}
                onChange={(e) => updateSection(section, { audio_url: e.target.value || null })}
                placeholder="Shared audio URL for this section (or set per-question below)"
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white"
              />
            )}
          </div>

          <div className="p-3 space-y-3">
            {section.questions.map((q, qi) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={qi}
                total={section.questions.length}
                sectionType={section.section_type}
                onChange={(patch) => updateQuestion(section, q, patch)}
                onDelete={() => deleteQuestion(section, q.id)}
                onMove={(dir) => {
                  const target = qi + dir;
                  if (target < 0 || target >= section.questions.length) return;
                  const reordered = [...section.questions];
                  [reordered[qi], reordered[target]] = [reordered[target], reordered[qi]];
                  reordered.forEach((rq, ri) => updateQuestion(section, rq, { sort_order: (ri + 1) * 10 }));
                }}
              />
            ))}
            {section.questions.length === 0 && <p className="text-xs text-secondary italic">No questions yet.</p>}
            <button type="button" onClick={() => addQuestion(section)} className="text-primary text-xs hover:underline">+ Add question</button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <select value={newSectionType} onChange={(e) => setNewSectionType(e.target.value as Section["section_type"])} className="text-sm border border-[var(--divider)] rounded-bento px-2 py-1.5 bg-white">
          {Object.entries(SECTION_TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <button type="button" onClick={addSection} className="px-3 py-1.5 rounded-bento bg-primary text-white text-sm">+ Add section</button>
      </div>

      {showGenerateModal && (
        <GenerateMockTestModal
          mode="append"
          targetPostId={postId}
          fixedLevel={jlptLevel}
          onClose={() => setShowGenerateModal(false)}
          onComplete={() => {
            // Let the modal show its own "Sections added." success state and Close button
            // (mirrors GenerateMockTestModal's own terminal-state UI) — refresh data now in the
            // background, but don't yank the modal away before the admin sees the result.
            load();
          }}
        />
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  sectionType,
  onChange,
  onDelete,
  onMove,
}: {
  question: Question;
  index: number;
  total: number;
  sectionType: Section["section_type"];
  onChange: (patch: Partial<Question>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const options = question.options.length > 0 ? question.options : ["", ""];

  function setOption(i: number, value: string) {
    onChange({ options: options.map((o, j) => (j === i ? value : o)) });
  }

  return (
    <div className="border border-[var(--divider)] rounded-bento p-3 space-y-2 bg-[var(--base)]">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-0.5 shrink-0 pt-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="text-secondary hover:text-charcoal disabled:opacity-30 text-xs leading-none">▲</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="text-secondary hover:text-charcoal disabled:opacity-30 text-xs leading-none">▼</button>
        </div>
        <textarea
          value={question.question_text}
          onChange={(e) => onChange({ question_text: e.target.value })}
          rows={2}
          className="flex-1 px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white"
          placeholder="Question text"
        />
        <button type="button" onClick={onDelete} className="text-red-600 hover:underline text-xs shrink-0 pt-1.5">Delete</button>
      </div>

      <input
        type="text"
        list={`item-type-options-${sectionType}`}
        value={question.item_type ?? ""}
        onChange={(e) => onChange({ item_type: e.target.value || null })}
        placeholder="JLPT item type tag (pick a suggestion or type your own)"
        className="w-full px-3 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white"
      />
      <datalist id={`item-type-options-${sectionType}`}>
        {itemTypesForSection(sectionType).map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </datalist>

      {sectionType === "listening" && (
        <input
          type="text"
          value={question.audio_url ?? ""}
          onChange={(e) => onChange({ audio_url: e.target.value || null })}
          placeholder="Per-question audio URL (overrides the section's shared audio)"
          className="w-full px-3 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white"
        />
      )}

      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={question.correct_index === i}
              onChange={() => onChange({ correct_index: i })}
              title="Correct answer"
            />
            <input
              type="text"
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="flex-1 px-3 py-1.5 border border-[var(--divider)] rounded-bento text-sm bg-white"
            />
            {options.length > 2 && (
              <button type="button" onClick={() => onChange({ options: options.filter((_, j) => j !== i), correct_index: question.correct_index === i ? 0 : question.correct_index })} className="text-red-600 text-xs">✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => onChange({ options: [...options, ""] })} className="text-primary text-xs hover:underline">+ Add option</button>
      </div>

      <textarea
        value={question.explanation ?? ""}
        onChange={(e) => onChange({ explanation: e.target.value || null })}
        placeholder="Explanation (shown after the learner answers)"
        rows={2}
        className="w-full px-3 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white"
      />
    </div>
  );
}
