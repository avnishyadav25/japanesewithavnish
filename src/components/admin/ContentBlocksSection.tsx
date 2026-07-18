"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_CATEGORIES,
  validateBlockData,
  type BlockType,
} from "@/lib/blocks/blockTypes";
import type { BlockAccessTier } from "@/lib/auth/blockAccess";

export const BLOCK_ACCESS_LABELS: Record<BlockAccessTier, string> = {
  public: "Public",
  preview: "Preview",
  free_account: "Free account",
  daily_unlocked: "Daily unlocked",
  premium: "Premium",
};

/**
 * Post-scoped sibling of LessonBlocksSection.tsx (curriculum lessons) — same block-type
 * registry and validation, own API (/api/admin/content/[postId]/blocks), own table
 * (content_blocks). Kept as a separate component rather than a shared abstraction on this
 * first pass, so the working, live curriculum lesson editor isn't touched/risked.
 */

type Block = {
  id: string;
  block_type: BlockType;
  block_data: Record<string, unknown>;
  sort_order: number;
  status: "draft" | "published";
  block_access?: BlockAccessTier;
  review_status?: "none" | "pending" | "approved" | "rejected";
};

type PickerKind = "vocabulary" | "grammar" | "kanji" | "kana";
const PICKER_FIELD: Partial<Record<BlockType, { field: string; kind: PickerKind }>> = {
  vocabulary_set: { field: "vocabularyIds", kind: "vocabulary" },
  grammar_rule: { field: "grammarIds", kind: "grammar" },
  kanji_focus: { field: "kanjiIds", kind: "kanji" },
  kana_grid: { field: "kanaIds", kind: "kana" },
  kana_character: { field: "kanaIds", kind: "kana" },
  similar_kanji: { field: "similarKanjiIds", kind: "kanji" },
};

function summarize(block: Block): string {
  const d = block.block_data;
  switch (block.block_type) {
    case "section_heading":
      return String(d.title ?? "");
    case "rich_text":
      return String(d.markdown ?? "").slice(0, 80);
    case "vocabulary_set":
      return `${(d.vocabularyIds as string[] | undefined)?.length ?? 0} word(s)`;
    case "grammar_rule":
      return `${(d.grammarIds as string[] | undefined)?.length ?? 0} pattern(s)`;
    case "kanji_focus":
      return `${(d.kanjiIds as string[] | undefined)?.length ?? 0} kanji`;
    case "kana_grid":
    case "kana_character":
      return `${(d.kanaIds as string[] | undefined)?.length ?? 0} kana`;
    case "dialogue":
      return `${(d.lines as unknown[] | undefined)?.length ?? 0} line(s)`;
    case "speaking_prompt":
      return String(d.promptJapanese ?? "").slice(0, 80);
    case "comprehension_question":
      return String(d.question ?? "").slice(0, 80);
    case "writing_prompt":
      return String(d.prompt ?? "").slice(0, 80);
    case "reading_passage":
      return String(d.title ?? "").slice(0, 80);
    case "kanji_radicals":
      return `${(d.radicals as unknown[] | undefined)?.length ?? 0} radical(s)`;
    case "similar_kanji":
      return `${(d.similarKanjiIds as string[] | undefined)?.length ?? 0} kanji`;
    case "memory_aid":
    case "nuance":
    case "register":
    case "when_not_to_use":
      return String(d.text ?? "").slice(0, 80);
    case "grammar_formation":
      return `${(d.variants as unknown[] | undefined)?.length ?? 0} variant(s)`;
    case "collocations":
      return `${(d.items as unknown[] | undefined)?.length ?? 0} phrase(s)`;
    case "related_words":
      return [...((d.synonyms as string[] | undefined) ?? []), ...((d.antonyms as string[] | undefined) ?? [])].slice(0, 5).join(", ") || "—";
    case "writing_canvas":
      return `${(d.characters as unknown[] | undefined)?.length ?? 0} character(s)`;
    case "resource_link":
      return String(d.title ?? "").slice(0, 80);
    case "next_lesson":
      return String(d.note ?? "").slice(0, 80) || "Next lesson";
    default:
      return JSON.stringify(d).slice(0, 80);
  }
}

export function ContentBlocksSection({ postId }: { postId: string }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [newType, setNewType] = useState<BlockType>("dialogue");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/content/${postId}/blocks`);
    const data = await res.json().catch(() => []);
    setBlocks(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function createBlock(blockType: BlockType) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content/${postId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block_type: blockType, block_data: defaultDataFor(blockType) }),
      });
      const created = await res.json();
      if (res.ok) {
        await load();
        setEditingId(created.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateBlock(id: string, patch: Partial<Pick<Block, "block_data" | "sort_order" | "status" | "block_access">>) {
    await fetch(`/api/admin/content/${postId}/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function deleteBlock(id: string) {
    if (!confirm("Delete this block?")) return;
    await fetch(`/api/admin/content/${postId}/blocks/${id}`, { method: "DELETE" });
    if (editingId === id) setEditingId(null);
    await load();
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(reordered); // optimistic
    await Promise.all(
      reordered.map((b, i) =>
        fetch(`/api/admin/content/${postId}/blocks/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: (i + 1) * 10 }),
        })
      )
    );
    await load();
  }

  return (
    <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
      <div>
        <h3 className="text-sm font-medium text-charcoal">Content blocks</h3>
        <p className="text-xs text-secondary">Structured blocks render on the public page instead of one large text field.</p>
      </div>

      <div className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <SortableBlockRow
                key={block.id}
                block={block}
                isEditing={editingId === block.id}
                onToggleEdit={() => setEditingId(editingId === block.id ? null : block.id)}
                onDelete={() => deleteBlock(block.id)}
                onSave={(data) => updateBlock(block.id, { block_data: data })}
                onAccessChange={(access) => updateBlock(block.id, { block_access: access })}
              />
            ))}
          </SortableContext>
        </DndContext>
        {blocks.length === 0 && <p className="text-secondary text-xs italic">No blocks yet — add one below.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--divider)]">
        <select aria-label="Add block type" value={newType} onChange={(e) => setNewType(e.target.value as BlockType)} className="text-sm border border-[var(--divider)] rounded-bento px-2 py-1.5 bg-white">
          {Object.entries(BLOCK_TYPE_CATEGORIES).map(([category, types]) => (
            <optgroup key={category} label={category}>
              {types.map((t) => (
                <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" onClick={() => createBlock(newType)} disabled={loading} className="px-3 py-1.5 rounded-bento bg-primary text-white text-sm disabled:opacity-60">
          + Add Block
        </button>
      </div>
    </div>
  );
}

function SortableBlockRow({
  block,
  isEditing,
  onToggleEdit,
  onDelete,
  onSave,
  onAccessChange,
}: {
  block: Block;
  isEditing: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onAccessChange: (access: BlockAccessTier) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-[var(--divider)] rounded-bento overflow-hidden bg-white">
      <div className="flex items-center justify-between bg-[var(--base)] px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            {...attributes}
            {...listeners}
            style={{ touchAction: "none" }}
            className="text-secondary hover:text-charcoal cursor-grab active:cursor-grabbing px-1 shrink-0 select-none"
            aria-label="Drag to reorder"
          >
            ⠿
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0">
            {BLOCK_TYPE_LABELS[block.block_type]}
          </span>
          <span className="text-secondary text-xs truncate">{summarize(block)}</span>
          {block.status === "draft" && <span className="text-[10px] text-amber-600 shrink-0">draft</span>}
          {block.review_status === "pending" && <span className="text-[10px] text-primary shrink-0">pending review</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            aria-label="Block access"
            value={block.block_access ?? "public"}
            onChange={(e) => onAccessChange(e.target.value as BlockAccessTier)}
            title={block.block_type === "section_heading" ? "Access tier for this section (nudges new blocks below it toward the same tier)" : "Access tier for this block"}
            className={`text-[10px] border rounded-bento px-1.5 py-1 bg-white ${
              block.block_type === "section_heading" ? "border-primary/40 font-semibold text-primary" : "border-[var(--divider)] text-secondary"
            } ${(block.block_access ?? "public") !== "public" ? "border-amber-400" : ""}`}
          >
            {Object.entries(BLOCK_ACCESS_LABELS).map(([tier, label]) => (
              <option key={tier} value={tier}>{label}</option>
            ))}
          </select>
          <button type="button" onClick={onToggleEdit} className="px-2 text-primary hover:underline text-xs">
            {isEditing ? "Close" : "Edit"}
          </button>
          <button type="button" onClick={onDelete} className="px-2 text-red-600 hover:underline text-xs">Delete</button>
        </div>
      </div>
      {isEditing && (
        <div className="p-3 border-t border-[var(--divider)]">
          <BlockEditForm block={block} onSave={onSave} />
        </div>
      )}
    </div>
  );
}

function defaultDataFor(blockType: BlockType): Record<string, unknown> {
  switch (blockType) {
    case "section_heading": return { title: "" };
    case "rich_text": return { markdown: "" };
    case "summary": return { items: [] };
    case "tip": case "culture_note": case "common_mistake": return { text: "" };
    case "vocabulary_set": return { vocabularyIds: [] };
    case "grammar_rule": return { grammarIds: [] };
    case "kanji_focus": return { kanjiIds: [] };
    case "kana_grid": case "kana_character": return { kanaIds: [] };
    case "example_set": return { exampleIds: [] };
    case "comparison": return { rows: [] };
    case "checkpoint": return { question: "", options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] };
    case "action_plan": return {};
    case "audio": return { audioUrl: "" };
    case "pronunciation": return { targetSound: "", correctGuidance: "" };
    case "dialogue": return { lines: [] };
    case "reading_passage": return { title: "", passage: "" };
    case "japanese_learning_text": return { japanese: "", meaning: "" };
    case "speaking_prompt": return { promptJapanese: "" };
    case "comprehension_question": return { question: "", skill: "detail", choices: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] };
    case "writing_prompt": return { prompt: "" };
    case "kanji_radicals": return { radicals: [] };
    case "similar_kanji": return { similarKanjiIds: [] };
    case "memory_aid": case "nuance": case "register": case "when_not_to_use": return { text: "" };
    case "grammar_formation": return { variants: [] };
    case "collocations": return { items: [] };
    case "related_words": return {};
    case "writing_canvas": return { characters: [] };
    case "resource_link": return { title: "", url: "", resourceType: "article" };
    case "next_lesson": return { lessonId: "" };
    default: return {};
  }
}

function BlockEditForm({ block, onSave }: { block: Block; onSave: (data: Record<string, unknown>) => void }) {
  const [data, setData] = useState<Record<string, unknown>>(block.block_data);
  const [errors, setErrors] = useState<string[]>([]);

  function set(field: string, value: unknown) {
    setData((d) => ({ ...d, [field]: value }));
  }

  function save() {
    const errs = validateBlockData(block.block_type, data);
    setErrors(errs);
    if (errs.length === 0) onSave(data);
  }

  const picker = PICKER_FIELD[block.block_type];

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
          {errors.join(", ")}
        </div>
      )}

      {block.block_type === "section_heading" && (
        <>
          <TextField label="Title" value={String(data.title ?? "")} onChange={(v) => set("title", v)} />
          <TextField label="Subtitle" value={String(data.subtitle ?? "")} onChange={(v) => set("subtitle", v)} />
        </>
      )}

      {block.block_type === "rich_text" && (
        <TextAreaField label="Markdown content" value={String(data.markdown ?? "")} onChange={(v) => set("markdown", v)} rows={6} />
      )}

      {(block.block_type === "tip" || block.block_type === "culture_note" || block.block_type === "common_mistake") && (
        <TextAreaField label="Text" value={String(data.text ?? "")} onChange={(v) => set("text", v)} rows={3} />
      )}

      {block.block_type === "summary" && (
        <TextAreaField
          label="Items (one per line)"
          value={((data.items as string[]) ?? []).join("\n")}
          onChange={(v) => set("items", v.split("\n").map((s) => s.trim()).filter(Boolean))}
          rows={5}
        />
      )}

      {block.block_type === "action_plan" && (
        <>
          <TextField label="Today" value={String(data.today ?? "")} onChange={(v) => set("today", v)} />
          <TextField label="Tomorrow" value={String(data.tomorrow ?? "")} onChange={(v) => set("tomorrow", v)} />
          <TextField label="This week" value={String(data.thisWeek ?? "")} onChange={(v) => set("thisWeek", v)} />
        </>
      )}

      {block.block_type === "japanese_learning_text" && (
        <>
          <TextField label="Japanese" value={String(data.japanese ?? "")} onChange={(v) => set("japanese", v)} />
          <TextField label="Furigana" value={String(data.furigana ?? "")} onChange={(v) => set("furigana", v)} />
          <TextField label="Romaji" value={String(data.romaji ?? "")} onChange={(v) => set("romaji", v)} />
          <TextField label="Meaning" value={String(data.meaning ?? "")} onChange={(v) => set("meaning", v)} />
          <TextField label="Audio URL" value={String(data.audioUrl ?? "")} onChange={(v) => set("audioUrl", v)} />
          <TextField label="Notes" value={String(data.notes ?? "")} onChange={(v) => set("notes", v)} />
        </>
      )}

      {block.block_type === "pronunciation" && (
        <>
          <TextField label="Target sound" value={String(data.targetSound ?? "")} onChange={(v) => set("targetSound", v)} />
          <TextField label="Common mistake" value={String(data.commonMistake ?? "")} onChange={(v) => set("commonMistake", v)} />
          <TextField label="Correct guidance" value={String(data.correctGuidance ?? "")} onChange={(v) => set("correctGuidance", v)} />
          <TextField label="Slow audio URL" value={String(data.audioSlowUrl ?? "")} onChange={(v) => set("audioSlowUrl", v)} />
          <TextField label="Normal audio URL" value={String(data.audioNormalUrl ?? "")} onChange={(v) => set("audioNormalUrl", v)} />
        </>
      )}

      {block.block_type === "audio" && (
        <>
          <TextField label="Audio URL" value={String(data.audioUrl ?? "")} onChange={(v) => set("audioUrl", v)} />
          <TextAreaField label="Transcript" value={String(data.transcript ?? "")} onChange={(v) => set("transcript", v)} rows={3} />
          <TextField label="Translation" value={String(data.translation ?? "")} onChange={(v) => set("translation", v)} />
          <TextField
            label="Duration (seconds)"
            value={data.durationSeconds != null ? String(data.durationSeconds) : ""}
            onChange={(v) => set("durationSeconds", v ? Number(v) : undefined)}
          />
        </>
      )}

      {block.block_type === "reading_passage" && (
        <>
          <TextField label="Title" value={String(data.title ?? "")} onChange={(v) => set("title", v)} />
          <TextAreaField label="Passage (Japanese)" value={String(data.passage ?? "")} onChange={(v) => set("passage", v)} rows={6} />
          <TextAreaField label="Furigana version (optional)" value={String(data.furiganaVersion ?? "")} onChange={(v) => set("furiganaVersion", v)} rows={6} />
          <TextAreaField label="Plain version (optional, no kanji readings needed)" value={String(data.plainVersion ?? "")} onChange={(v) => set("plainVersion", v)} rows={4} />
          <TextAreaField label="Translation" value={String(data.translation ?? "")} onChange={(v) => set("translation", v)} rows={4} />
          <TextField
            label="Estimated reading minutes"
            value={data.estimatedReadingMinutes != null ? String(data.estimatedReadingMinutes) : ""}
            onChange={(v) => set("estimatedReadingMinutes", v ? Number(v) : undefined)}
          />
        </>
      )}

      {block.block_type === "comprehension_question" && (
        <ComprehensionQuestionFields
          question={String(data.question ?? "")}
          skill={String(data.skill ?? "detail")}
          choices={(data.choices as { text: string; isCorrect: boolean }[]) ?? []}
          explanation={String(data.explanation ?? "")}
          onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
        />
      )}

      {block.block_type === "writing_prompt" && (
        <>
          <TextAreaField label="Prompt (task description)" value={String(data.prompt ?? "")} onChange={(v) => set("prompt", v)} rows={3} />
          <TextField label="Expected length (e.g. 80-120 characters)" value={String(data.expectedLength ?? "")} onChange={(v) => set("expectedLength", v)} />
          <TextField
            label="Target grammar (comma-separated)"
            value={((data.targetGrammar as string[]) ?? []).join(", ")}
            onChange={(v) => set("targetGrammar", v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined)}
          />
          <TextField
            label="Target vocabulary (comma-separated)"
            value={((data.targetVocabulary as string[]) ?? []).join(", ")}
            onChange={(v) => set("targetVocabulary", v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined)}
          />
          <TextAreaField
            label="Checklist (one per line)"
            value={((data.checklist as string[]) ?? []).join("\n")}
            onChange={(v) => set("checklist", v ? v.split("\n").map((s) => s.trim()).filter(Boolean) : undefined)}
            rows={3}
          />
        </>
      )}

      {block.block_type === "speaking_prompt" && (
        <>
          <TextField label="Prompt (Japanese)" value={String(data.promptJapanese ?? "")} onChange={(v) => set("promptJapanese", v)} />
          <TextField label="Prompt (English)" value={String(data.promptEnglish ?? "")} onChange={(v) => set("promptEnglish", v)} />
          <TextField label="Model answer audio URL" value={String(data.modelAnswerAudioUrl ?? "")} onChange={(v) => set("modelAnswerAudioUrl", v)} />
          <label className="flex items-center gap-2 text-xs text-secondary">
            <input type="checkbox" checked={Boolean(data.recordEnabled)} onChange={(e) => set("recordEnabled", e.target.checked)} />
            Allow learner to record a response
          </label>
        </>
      )}

      {block.block_type === "checkpoint" && (
        <CheckpointFields
          question={String(data.question ?? "")}
          options={(data.options as { text: string; isCorrect: boolean }[]) ?? []}
          onChange={(question, options) => setData((d) => ({ ...d, question, options }))}
        />
      )}

      {block.block_type === "comparison" && (
        <ComparisonFields
          rows={(data.rows as { pattern: string; meaning: string; usage: string }[]) ?? []}
          onChange={(rows) => set("rows", rows)}
        />
      )}

      {block.block_type === "dialogue" && (
        <DialogueFields
          lines={(data.lines as { speaker: string; japanese: string; translation?: string }[]) ?? []}
          onChange={(lines) => set("lines", lines)}
        />
      )}

      {block.block_type === "kanji_radicals" && (
        <KanjiRadicalsFields
          radicals={(data.radicals as { character: string; meaning: string; strokeCount?: number }[]) ?? []}
          onChange={(radicals) => set("radicals", radicals)}
        />
      )}

      {(block.block_type === "memory_aid" || block.block_type === "nuance" || block.block_type === "register" || block.block_type === "when_not_to_use") && (
        <TextAreaField
          label={
            block.block_type === "memory_aid"
              ? "Mnemonic (a memory aid, not a historical/etymological claim)"
              : block.block_type === "nuance"
              ? "Nuance"
              : block.block_type === "register"
              ? "Register (formal / casual / written / spoken, etc.)"
              : "When not to use"
          }
          value={String(data.text ?? "")}
          onChange={(v) => set("text", v)}
          rows={3}
        />
      )}

      {block.block_type === "grammar_formation" && (
        <GrammarFormationFields
          variants={(data.variants as { label: string; form: string; example?: string }[]) ?? []}
          onChange={(variants) => set("variants", variants)}
        />
      )}

      {block.block_type === "collocations" && (
        <CollocationsFields
          items={(data.items as { phrase: string; translation?: string }[]) ?? []}
          onChange={(items) => set("items", items)}
        />
      )}

      {block.block_type === "related_words" && (
        <>
          <TextField
            label="Synonyms (comma-separated)"
            value={((data.synonyms as string[]) ?? []).join(", ")}
            onChange={(v) => set("synonyms", v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined)}
          />
          <TextField
            label="Antonyms (comma-separated)"
            value={((data.antonyms as string[]) ?? []).join(", ")}
            onChange={(v) => set("antonyms", v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined)}
          />
          <TextField
            label="Word family (comma-separated)"
            value={((data.wordFamily as string[]) ?? []).join(", ")}
            onChange={(v) => set("wordFamily", v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined)}
          />
        </>
      )}

      {picker && (
        <ReferencePicker
          kind={picker.kind}
          selectedIds={(data[picker.field] as string[]) ?? []}
          onChange={(ids) => set(picker.field, ids)}
        />
      )}
      {block.block_type === "similar_kanji" && (
        <TextField label="Note (why these are confusable)" value={String(data.note ?? "")} onChange={(v) => set("note", v)} />
      )}

      {block.block_type === "writing_canvas" && (
        <WritingCanvasFields
          instructions={String(data.instructions ?? "")}
          characters={(data.characters as { character: string; characterType: string; reading?: string; meaning?: string }[]) ?? []}
          onChange={(instructions, characters) => setData((d) => ({ ...d, instructions, characters }))}
        />
      )}

      {block.block_type === "resource_link" && (
        <>
          <TextField label="Title" value={String(data.title ?? "")} onChange={(v) => set("title", v)} />
          <TextField label="URL" value={String(data.url ?? "")} onChange={(v) => set("url", v)} />
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Resource type</label>
            <select
              value={String(data.resourceType ?? "article")}
              onChange={(e) => set("resourceType", e.target.value)}
              className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white"
            >
              {["article", "video", "audio", "tool", "pdf", "other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <TextAreaField label="Description (optional)" value={String(data.description ?? "")} onChange={(v) => set("description", v)} rows={2} />
        </>
      )}

      {block.block_type === "next_lesson" && (
        <>
          <TextField label="Lesson ID (UUID of the target curriculum lesson)" value={String(data.lessonId ?? "")} onChange={(v) => set("lessonId", v)} />
          <p className="text-[10px] text-secondary -mt-2">No lesson search picker exists yet — copy the ID from the lesson&apos;s admin URL.</p>
          <TextField label="Note (optional label, defaults to &apos;Next lesson&apos;)" value={String(data.note ?? "")} onChange={(v) => set("note", v)} />
        </>
      )}

      <button type="button" onClick={save} className="btn-primary text-sm px-4 py-1.5">Save block</button>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-secondary mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
    </div>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-secondary mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm font-mono" />
    </div>
  );
}

function CheckpointFields({
  question,
  options,
  onChange,
}: {
  question: string;
  options: { text: string; isCorrect: boolean }[];
  onChange: (question: string, options: { text: string; isCorrect: boolean }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <TextField label="Question" value={question} onChange={(v) => onChange(v, options)} />
      <label className="block text-xs font-medium text-secondary">Options</label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" checked={opt.isCorrect} onChange={() => onChange(question, options.map((o, j) => ({ ...o, isCorrect: j === i })))} />
          <input
            type="text"
            value={opt.text}
            onChange={(e) => onChange(question, options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)))}
            placeholder={`Option ${i + 1}`}
            className="flex-1 px-3 py-1.5 border border-[var(--divider)] rounded-bento text-sm"
          />
          <button type="button" onClick={() => onChange(question, options.filter((_, j) => j !== i))} className="text-red-600 text-xs">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange(question, [...options, { text: "", isCorrect: false }])} className="text-primary text-xs hover:underline">+ Add option</button>
    </div>
  );
}

const COMPREHENSION_SKILLS = [
  { value: "main_idea", label: "Main idea" },
  { value: "detail", label: "Specific detail" },
  { value: "inference", label: "Inference" },
  { value: "writer_intention", label: "Writer intention" },
  { value: "paraphrase", label: "Paraphrase" },
];

function ComprehensionQuestionFields({
  question,
  skill,
  choices,
  explanation,
  onChange,
}: {
  question: string;
  skill: string;
  choices: { text: string; isCorrect: boolean }[];
  explanation: string;
  onChange: (patch: { question?: string; skill?: string; choices?: { text: string; isCorrect: boolean }[]; explanation?: string }) => void;
}) {
  return (
    <div className="space-y-2">
      <TextField label="Question" value={question} onChange={(v) => onChange({ question: v })} />
      <div>
        <label className="block text-xs font-medium text-secondary mb-1">Skill tested</label>
        <select value={skill} onChange={(e) => onChange({ skill: e.target.value })} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white">
          {COMPREHENSION_SKILLS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <label className="block text-xs font-medium text-secondary">Choices</label>
      {choices.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" checked={opt.isCorrect} onChange={() => onChange({ choices: choices.map((o, j) => ({ ...o, isCorrect: j === i })) })} />
          <input
            type="text"
            value={opt.text}
            onChange={(e) => onChange({ choices: choices.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)) })}
            placeholder={`Choice ${i + 1}`}
            className="flex-1 px-3 py-1.5 border border-[var(--divider)] rounded-bento text-sm"
          />
          <button type="button" onClick={() => onChange({ choices: choices.filter((_, j) => j !== i) })} className="text-red-600 text-xs">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ choices: [...choices, { text: "", isCorrect: false }] })} className="text-primary text-xs hover:underline">+ Add choice</button>
      <TextAreaField label="Explanation (why the correct answer is correct)" value={explanation} onChange={(v) => onChange({ explanation: v })} rows={2} />
    </div>
  );
}

function ComparisonFields({
  rows,
  onChange,
}: {
  rows: { pattern: string; meaning: string; usage: string }[];
  onChange: (rows: { pattern: string; meaning: string; usage: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-secondary">Comparison rows</label>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-3 gap-1.5">
          <input value={row.pattern} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, pattern: e.target.value } : r)))} placeholder="Pattern" className="px-2 py-1.5 border rounded text-sm" />
          <input value={row.meaning} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, meaning: e.target.value } : r)))} placeholder="Meaning" className="px-2 py-1.5 border rounded text-sm" />
          <div className="flex gap-1">
            <input value={row.usage} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, usage: e.target.value } : r)))} placeholder="Usage" className="flex-1 px-2 py-1.5 border rounded text-sm" />
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { pattern: "", meaning: "", usage: "" }])} className="text-primary text-xs hover:underline">+ Add row</button>
    </div>
  );
}

function DialogueFields({
  lines,
  onChange,
}: {
  lines: { speaker: string; japanese: string; translation?: string }[];
  onChange: (lines: { speaker: string; japanese: string; translation?: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-secondary">Dialogue lines</label>
      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-3 gap-1.5">
          <input value={line.speaker} onChange={(e) => onChange(lines.map((l, j) => (j === i ? { ...l, speaker: e.target.value } : l)))} placeholder="Speaker" className="px-2 py-1.5 border rounded text-sm" />
          <input value={line.japanese} onChange={(e) => onChange(lines.map((l, j) => (j === i ? { ...l, japanese: e.target.value } : l)))} placeholder="Japanese" className="px-2 py-1.5 border rounded text-sm" />
          <div className="flex gap-1">
            <input value={line.translation ?? ""} onChange={(e) => onChange(lines.map((l, j) => (j === i ? { ...l, translation: e.target.value } : l)))} placeholder="Translation" className="flex-1 px-2 py-1.5 border rounded text-sm" />
            <button type="button" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...lines, { speaker: "A", japanese: "" }])} className="text-primary text-xs hover:underline">+ Add line</button>
    </div>
  );
}

function KanjiRadicalsFields({
  radicals,
  onChange,
}: {
  radicals: { character: string; meaning: string; strokeCount?: number }[];
  onChange: (radicals: { character: string; meaning: string; strokeCount?: number }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-secondary">Radicals</label>
      {radicals.map((r, i) => (
        <div key={i} className="grid grid-cols-4 gap-1.5">
          <input value={r.character} onChange={(e) => onChange(radicals.map((x, j) => (j === i ? { ...x, character: e.target.value } : x)))} placeholder="部" className="px-2 py-1.5 border rounded text-sm" />
          <input value={r.meaning} onChange={(e) => onChange(radicals.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)))} placeholder="Meaning" className="col-span-2 px-2 py-1.5 border rounded text-sm" />
          <div className="flex gap-1">
            <input
              type="number"
              value={r.strokeCount ?? ""}
              onChange={(e) => onChange(radicals.map((x, j) => (j === i ? { ...x, strokeCount: e.target.value ? Number(e.target.value) : undefined } : x)))}
              placeholder="Strokes"
              className="w-16 px-2 py-1.5 border rounded text-sm"
            />
            <button type="button" onClick={() => onChange(radicals.filter((_, j) => j !== i))} className="text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...radicals, { character: "", meaning: "" }])} className="text-primary text-xs hover:underline">+ Add radical</button>
    </div>
  );
}

function WritingCanvasFields({
  instructions,
  characters,
  onChange,
}: {
  instructions: string;
  characters: { character: string; characterType: string; reading?: string; meaning?: string }[];
  onChange: (instructions: string, characters: { character: string; characterType: string; reading?: string; meaning?: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <TextAreaField label="Instructions (optional)" value={instructions} onChange={(v) => onChange(v, characters)} rows={2} />
      <label className="block text-xs font-medium text-secondary">Characters to practice</label>
      {characters.map((c, i) => (
        <div key={i} className="grid grid-cols-5 gap-1.5">
          <input
            value={c.character}
            onChange={(e) => onChange(instructions, characters.map((x, j) => (j === i ? { ...x, character: e.target.value } : x)))}
            placeholder="字"
            className="px-2 py-1.5 border rounded text-sm"
          />
          <select
            value={c.characterType}
            onChange={(e) => onChange(instructions, characters.map((x, j) => (j === i ? { ...x, characterType: e.target.value } : x)))}
            className="px-2 py-1.5 border rounded text-sm bg-white"
          >
            <option value="kanji">Kanji</option>
            <option value="hiragana">Hiragana</option>
            <option value="katakana">Katakana</option>
          </select>
          <input
            value={c.reading ?? ""}
            onChange={(e) => onChange(instructions, characters.map((x, j) => (j === i ? { ...x, reading: e.target.value } : x)))}
            placeholder="Reading"
            className="px-2 py-1.5 border rounded text-sm"
          />
          <div className="flex gap-1">
            <input
              value={c.meaning ?? ""}
              onChange={(e) => onChange(instructions, characters.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)))}
              placeholder="Meaning"
              className="flex-1 px-2 py-1.5 border rounded text-sm"
            />
            <button type="button" onClick={() => onChange(instructions, characters.filter((_, j) => j !== i))} className="text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange(instructions, [...characters, { character: "", characterType: "kanji" }])}
        className="text-primary text-xs hover:underline"
      >
        + Add character
      </button>
    </div>
  );
}

function GrammarFormationFields({
  variants,
  onChange,
}: {
  variants: { label: string; form: string; example?: string }[];
  onChange: (variants: { label: string; form: string; example?: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-secondary">Formation variants</label>
      {variants.map((v, i) => (
        <div key={i} className="grid grid-cols-3 gap-1.5">
          <input value={v.label} onChange={(e) => onChange(variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label (e.g. Present affirmative)" className="px-2 py-1.5 border rounded text-sm" />
          <input value={v.form} onChange={(e) => onChange(variants.map((x, j) => (j === i ? { ...x, form: e.target.value } : x)))} placeholder="Form" className="px-2 py-1.5 border rounded text-sm" />
          <div className="flex gap-1">
            <input value={v.example ?? ""} onChange={(e) => onChange(variants.map((x, j) => (j === i ? { ...x, example: e.target.value } : x)))} placeholder="Example" className="flex-1 px-2 py-1.5 border rounded text-sm" />
            <button type="button" onClick={() => onChange(variants.filter((_, j) => j !== i))} className="text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...variants, { label: "", form: "" }])} className="text-primary text-xs hover:underline">+ Add variant</button>
    </div>
  );
}

function CollocationsFields({
  items,
  onChange,
}: {
  items: { phrase: string; translation?: string }[];
  onChange: (items: { phrase: string; translation?: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-secondary">Collocations</label>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-2 gap-1.5">
          <input value={it.phrase} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, phrase: e.target.value } : x)))} placeholder="Phrase" className="px-2 py-1.5 border rounded text-sm" />
          <div className="flex gap-1">
            <input value={it.translation ?? ""} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, translation: e.target.value } : x)))} placeholder="Translation" className="flex-1 px-2 py-1.5 border rounded text-sm" />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-red-600 text-xs">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { phrase: "" }])} className="text-primary text-xs hover:underline">+ Add phrase</button>
    </div>
  );
}

function ReferencePicker({
  kind,
  selectedIds,
  onChange,
}: {
  kind: PickerKind;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (query.length < 1) {
      setOptions([]);
      return;
    }
    fetch(`/api/admin/curriculum/picker/${kind}?q=${encodeURIComponent(query)}&limit=15`)
      .then((r) => r.json())
      .then((arr: { id: string; word?: string; pattern?: string; character?: string; title?: string }[]) => {
        const opts = (Array.isArray(arr) ? arr : []).map((x) => ({
          id: x.id,
          label: x.word ?? x.pattern ?? x.character ?? x.title ?? x.id.slice(0, 8),
        }));
        setOptions(opts);
        setSelectedLabels((prev) => {
          const next = { ...prev };
          opts.forEach((o) => (next[o.id] = o.label));
          return next;
        });
      })
      .catch(() => setOptions([]));
  }, [kind, query]);

  return (
    <div>
      <label className="block text-xs font-medium text-secondary mb-1">
        {kind === "vocabulary" ? "Vocabulary" : kind === "grammar" ? "Grammar" : kind === "kanji" ? "Kanji" : "Kana"} (search to add)
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 bg-[var(--divider)]/30 rounded-full px-2 py-1 text-xs">
            {selectedLabels[id] ?? id.slice(0, 8)}
            <button type="button" onClick={() => onChange(selectedIds.filter((x) => x !== id))} className="text-red-600">✕</button>
          </span>
        ))}
      </div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm" />
      {options.length > 0 && (
        <ul className="border border-[var(--divider)] rounded-bento max-h-32 overflow-auto mt-1">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  if (!selectedIds.includes(o.id)) onChange([...selectedIds, o.id]);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--divider)]/30"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
