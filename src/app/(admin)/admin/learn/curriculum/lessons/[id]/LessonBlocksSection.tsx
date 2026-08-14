"use client";

import { useState, useEffect, useCallback } from "react";
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
import { BLOCK_ACCESS_LABELS } from "@/components/admin/ContentBlocksSection";

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
    default:
      return JSON.stringify(d).slice(0, 80);
  }
}

export function LessonBlocksSection({ lessonId }: { lessonId: string }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [checklist, setChecklist] = useState<{ blockType: BlockType; label: string; present: boolean }[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [newType, setNewType] = useState<BlockType>("rich_text");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [contentLLM, setContentLLM] = useState<"deepseek" | "gemini">("deepseek");

  const load = useCallback(async () => {
    const [blocksRes, checklistRes] = await Promise.all([
      fetch(`/api/admin/curriculum/lessons/${lessonId}/blocks`),
      fetch(`/api/admin/curriculum/lessons/${lessonId}/completeness`),
    ]);
    const data = await blocksRes.json();
    setBlocks(Array.isArray(data) ? data : []);
    const checklistData = await checklistRes.json();
    setChecklist(Array.isArray(checklistData) ? checklistData : []);
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateWithAI() {
    setGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/ai/curriculum/generate-lesson-body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, content_llm: contentLLM }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Generate failed");
      await load();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function createBlock(blockType: BlockType) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/blocks`, {
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
    await fetch(`/api/admin/curriculum/lessons/${lessonId}/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function deleteBlock(id: string) {
    if (!confirm("Delete this block?")) return;
    await fetch(`/api/admin/curriculum/lessons/${lessonId}/blocks/${id}`, { method: "DELETE" });
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
        fetch(`/api/admin/curriculum/lessons/${lessonId}/blocks/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: (i + 1) * 10 }),
        })
      )
    );
    await load();
  }

  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
      <h3 className="font-heading font-semibold text-charcoal mb-1">Lesson Content Blocks</h3>
      <p className="text-secondary text-xs mb-4">Structured content blocks render on the student lesson page.</p>

      {checklist.some((c) => !c.present) && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-bento text-xs">
          <p className="font-bold text-amber-800 mb-1">This lesson type usually includes:</p>
          <ul className="space-y-0.5">
            {checklist.map((c) => (
              <li key={c.blockType} className={c.present ? "text-green-700" : "text-amber-700"}>
                {c.present ? "✓" : "○"} {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {blocks.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-[var(--divider)]">
          <select
            value={contentLLM}
            onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")}
            className="text-sm border border-[var(--divider)] rounded-bento px-2 py-1.5 bg-white"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Gemini</option>
          </select>
          <button type="button" onClick={generateWithAI} disabled={generating} className="px-3 py-1.5 rounded-bento bg-primary text-white text-sm disabled:opacity-60">
            {generating ? "Generating…" : "Generate lesson body with AI"}
          </button>
          {generateError && <p className="text-red-600 text-xs w-full">{generateError}</p>}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <SortableBlockRow
                key={block.id}
                block={block}
                lessonId={lessonId}
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
  lessonId,
  isEditing,
  onToggleEdit,
  onDelete,
  onSave,
  onAccessChange,
}: {
  block: Block;
  lessonId: string;
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
          <BlockEditForm block={block} lessonId={lessonId} onSave={onSave} />
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
    default: return {};
  }
}

function BlockEditForm({ block, lessonId, onSave }: { block: Block; lessonId: string; onSave: (data: Record<string, unknown>) => void }) {
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
        </>
      )}

      {block.block_type === "reading_passage" && (
        <>
          <TextField label="Title" value={String(data.title ?? "")} onChange={(v) => set("title", v)} />
          <TextAreaField label="Passage" value={String(data.passage ?? "")} onChange={(v) => set("passage", v)} rows={6} />
          <TextAreaField label="Translation" value={String(data.translation ?? "")} onChange={(v) => set("translation", v)} rows={4} />
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

      {block.block_type === "example_set" && (
        <ExamplePicker lessonId={lessonId} exampleIds={(data.exampleIds as string[]) ?? []} onChange={(ids) => set("exampleIds", ids)} />
      )}

      {picker && (
        <ReferencePicker
          kind={picker.kind}
          selectedIds={(data[picker.field] as string[]) ?? []}
          onChange={(ids) => set(picker.field, ids)}
        />
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

function ExamplePicker({ lessonId, exampleIds, onChange }: { lessonId: string; exampleIds: string[]; onChange: (ids: string[]) => void }) {
  const [options, setOptions] = useState<{ id: string; sentence_ja: string; sentence_en: string }[]>([]);

  useEffect(() => {
    fetch(`/api/admin/examples?lessonId=${lessonId}`).then((r) => r.json()).then((d) => Array.isArray(d) && setOptions(d)).catch(() => {});
  }, [lessonId]);

  function toggle(id: string) {
    onChange(exampleIds.includes(id) ? exampleIds.filter((x) => x !== id) : [...exampleIds, id]);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-secondary mb-1">Examples linked to this lesson</label>
      {options.length === 0 && <p className="text-xs text-secondary italic">No examples linked to this lesson yet — add some in the sidebar first.</p>}
      <ul className="space-y-1">
        {options.map((o) => (
          <li key={o.id} className="flex items-start gap-2">
            <input type="checkbox" checked={exampleIds.includes(o.id)} onChange={() => toggle(o.id)} className="mt-0.5" />
            <span className="text-xs text-charcoal">{o.sentence_ja} — {o.sentence_en}</span>
          </li>
        ))}
      </ul>
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
