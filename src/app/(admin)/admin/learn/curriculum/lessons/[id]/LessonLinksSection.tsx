"use client";

import { useState, useEffect, useCallback } from "react";

type ContentLink = { id: string; content_slug: string; content_role: string; sort_order: number; title: string | null };
type VocabLink = { id: string; vocabulary_id: string; word: string | null; reading: string | null; meaning: string | null };
type GrammarLink = { id: string; grammar_id: string; pattern: string | null; structure: string | null };
type KanjiLink = { id: string; kanji_id: string; character: string | null; meaning: string | null };
type KanaLink = { id: string; kana_id: string; character: string; type: string; romaji: string; row_label: string | null };
type ExampleRow = { id: string; sentence_ja: string; sentence_romaji: string | null; sentence_en: string; notes: string | null };

type VocabGenerated = { word: string; reading: string; meaning: string };

export function LessonLinksSection({ lessonId, lessonTitle = "", levelCode = "N5" }: { lessonId: string; lessonTitle?: string; levelCode?: string }) {
  const [content, setContent] = useState<ContentLink[]>([]);
  const [vocab, setVocab] = useState<VocabLink[]>([]);
  const [grammar, setGrammar] = useState<GrammarLink[]>([]);
  const [kanji, setKanji] = useState<KanjiLink[]>([]);
  const [kana, setKana] = useState<KanaLink[]>([]);
  const [examples, setExamples] = useState<ExampleRow[]>([]);
  const [newSlug, setNewSlug] = useState("");
  const [pickerType, setPickerType] = useState<"vocab" | "grammar" | "kanji" | "kana" | null>(null);
  const [kanaPickerType, setKanaPickerType] = useState<"hiragana" | "katakana">("hiragana");
  const [pickerQ, setPickerQ] = useState("");
  const [pickerOptions, setPickerOptions] = useState<{ id: string; label: string }[]>([]);
  const [exampleForm, setExampleForm] = useState({ sentence_ja: "", sentence_romaji: "", sentence_en: "", notes: "" });
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [generatedVocab, setGeneratedVocab] = useState<VocabGenerated[] | null>(null);
  const [contentLLM, setContentLLM] = useState<"deepseek" | "gemini">("deepseek");
  const [newExerciseSlug, setNewExerciseSlug] = useState("");
  const [newExerciseTitle, setNewExerciseTitle] = useState("");
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editExerciseTitle, setEditExerciseTitle] = useState("");
  const [editExerciseSort, setEditExerciseSort] = useState(0);

  const load = useCallback(async () => {
    const base = "/api/admin";
    const [c, v, g, k, ka, ex] = await Promise.all([
      fetch(`${base}/curriculum/lessons/${lessonId}/content`).then((r) => r.json()),
      fetch(`${base}/curriculum/lessons/${lessonId}/vocabulary`).then((r) => r.json()),
      fetch(`${base}/curriculum/lessons/${lessonId}/grammar`).then((r) => r.json()),
      fetch(`${base}/curriculum/lessons/${lessonId}/kanji`).then((r) => r.json()),
      fetch(`${base}/curriculum/lessons/${lessonId}/kana`).then((r) => r.json()),
      fetch(`${base}/examples?lessonId=${lessonId}`).then((r) => r.json()),
    ]);
    setContent(Array.isArray(c) ? c : []);
    setVocab(Array.isArray(v) ? v : []);
    setGrammar(Array.isArray(g) ? g : []);
    setKanji(Array.isArray(k) ? k : []);
    setKana(Array.isArray(ka) ? ka : []);
    setExamples(Array.isArray(ex) ? ex : []);
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (pickerType === "kana") {
      fetch(`/api/admin/curriculum/picker/kana?type=${kanaPickerType}&q=${encodeURIComponent(pickerQ)}&limit=30`)
        .then((r) => r.json())
        .then((arr: { id: string; character: string; romaji: string; type: string }[]) => {
          setPickerOptions(
            (Array.isArray(arr) ? arr : []).map((x) => ({
              id: x.id,
              label: `${x.character} (${x.romaji})`,
            }))
          );
        })
        .catch(() => setPickerOptions([]));
      return;
    }
    if (!pickerType || pickerQ.length < 1) {
      setPickerOptions([]);
      return;
    }
    const t = pickerType === "vocab" ? "vocabulary" : pickerType;
    fetch(`/api/admin/curriculum/picker/${t}?q=${encodeURIComponent(pickerQ)}&limit=15`)
      .then((r) => r.json())
      .then((arr: { id: string; word?: string; title?: string; pattern?: string; character?: string; meaning?: string }[]) => {
        setPickerOptions(
          (Array.isArray(arr) ? arr : []).map((x) => ({
            id: x.id,
            label: x.word ?? x.pattern ?? x.character ?? x.title ?? x.id.slice(0, 8),
          }))
        );
      })
      .catch(() => setPickerOptions([]));
  }, [pickerType, pickerQ, kanaPickerType]);

  async function addContent() {
    if (!newSlug.trim()) return;
    const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_slug: newSlug.trim() }),
    });
    if (res.ok) {
      setNewSlug("");
      load();
    }
  }

  async function removeContent(contentId: string) {
    await fetch(`/api/admin/curriculum/lessons/${lessonId}/content/${contentId}`, { method: "DELETE" });
    load();
  }

  const exercises = content.filter((c) => c.content_role === "exercise");

  async function addExercise() {
    if (!newExerciseSlug.trim()) return;
    const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_slug: newExerciseSlug.trim(),
        content_role: "exercise",
        title: newExerciseTitle.trim() || null,
        sort_order: exercises.length,
      }),
    });
    if (res.ok) {
      setNewExerciseSlug("");
      setNewExerciseTitle("");
      load();
    }
  }

  function startEditExercise(c: ContentLink) {
    setEditingExerciseId(c.id);
    setEditExerciseTitle(c.title ?? "");
    setEditExerciseSort(typeof c.sort_order === "number" ? c.sort_order : 0);
  }

  async function saveExerciseEdit() {
    if (!editingExerciseId) return;
    const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/content/${editingExerciseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editExerciseTitle.trim() || null, sort_order: editExerciseSort }),
    });
    if (res.ok) {
      setEditingExerciseId(null);
      load();
    }
  }

  async function addLink(type: "vocabulary" | "grammar" | "kanji" | "kana", id: string) {
    const key = type === "vocabulary" ? "vocabulary_id" : type === "grammar" ? "grammar_id" : type === "kanji" ? "kanji_id" : "kana_id";
    const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: id }),
    });
    if (res.ok) {
      setPickerType(null);
      setPickerQ("");
      load();
    }
  }

  async function removeLink(type: "vocabulary" | "grammar" | "kanji" | "kana", linkId: string) {
    await fetch(`/api/admin/curriculum/lessons/${lessonId}/${type}/${linkId}`, { method: "DELETE" });
    load();
  }

  async function addExample() {
    if (!exampleForm.sentence_ja.trim() || !exampleForm.sentence_en.trim()) return;
    const res = await fetch("/api/admin/examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_id: lessonId,
        sentence_ja: exampleForm.sentence_ja.trim(),
        sentence_romaji: exampleForm.sentence_romaji.trim() || null,
        sentence_en: exampleForm.sentence_en.trim(),
        notes: exampleForm.notes.trim() || null,
      }),
    });
    if (res.ok) {
      setExampleForm({ sentence_ja: "", sentence_romaji: "", sentence_en: "", notes: "" });
      load();
    }
  }

  async function deleteExample(id: string) {
    await fetch(`/api/admin/examples/${id}`, { method: "DELETE" });
    load();
  }

  async function generateExamples() {
    if (!lessonTitle) return;
    setExamplesLoading(true);
    setGeneratedVocab(null);
    try {
      const res = await fetch("/api/ai/curriculum/generate-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonTitle, levelCode, count: 5, content_llm: contentLLM }),
      });
      const data = await res.json();
      if (Array.isArray(data.items)) {
        for (const it of data.items) {
          if (it.sentence_ja && it.sentence_en) {
            await fetch("/api/admin/examples", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lesson_id: lessonId,
                sentence_ja: it.sentence_ja,
                sentence_romaji: it.sentence_romaji || null,
                sentence_en: it.sentence_en,
              }),
            });
          }
        }
        load();
      }
    } finally {
      setExamplesLoading(false);
    }
  }

  async function generateVocabList() {
    if (!lessonTitle) return;
    setVocabLoading(true);
    setExamplesLoading(false);
    try {
      const res = await fetch("/api/ai/curriculum/generate-lesson-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonTitle, levelCode, count: 10, content_llm: contentLLM }),
      });
      const data = await res.json();
      if (Array.isArray(data.items)) setGeneratedVocab(data.items);
      else setGeneratedVocab([]);
    } finally {
      setVocabLoading(false);
    }
  }

  return (
    <div className="mt-10 space-y-8 max-w-2xl">
      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Content links (slugs)</h3>
        <ul className="space-y-1 mb-2">
          {content.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span className="text-charcoal">{c.content_slug}</span>
              <span className="text-secondary text-xs">({c.content_role})</span>
              <button type="button" onClick={() => removeContent(c.id)} className="text-red-600 hover:underline text-xs">
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="Content slug"
            className="flex-1 px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
          />
          <button type="button" onClick={addContent} className="px-3 py-2 rounded-bento bg-primary text-white text-sm">
            Add
          </button>
        </div>
      </section>

      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Exercises</h3>
        <p className="text-secondary text-sm mb-2">Content links with role &quot;exercise&quot; (shown at bottom of lesson page).</p>
        <ul className="space-y-2 mb-2">
          {exercises.map((ex) => (
            <li key={ex.id} className="flex items-center gap-2 text-sm border border-[var(--divider)] rounded-bento p-2">
              {editingExerciseId === ex.id ? (
                <>
                  <input
                    type="text"
                    value={editExerciseTitle}
                    onChange={(e) => setEditExerciseTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="number"
                    value={editExerciseSort}
                    onChange={(e) => setEditExerciseSort(Number(e.target.value))}
                    className="w-16 px-2 py-1 border rounded text-sm"
                  />
                  <button type="button" onClick={saveExerciseEdit} className="text-primary text-xs hover:underline">Save</button>
                  <button type="button" onClick={() => setEditingExerciseId(null)} className="text-secondary text-xs hover:underline">Cancel</button>
                </>
              ) : (
                <>
                  <span className="text-charcoal font-medium">{ex.title?.trim() || ex.content_slug}</span>
                  <span className="text-secondary text-xs">slug: {ex.content_slug}</span>
                  <span className="text-secondary text-xs">order: {ex.sort_order}</span>
                  <button type="button" onClick={() => startEditExercise(ex)} className="text-primary hover:underline text-xs">Edit</button>
                  <button type="button" onClick={() => removeContent(ex.id)} className="text-red-600 hover:underline text-xs">Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={newExerciseSlug}
            onChange={(e) => setNewExerciseSlug(e.target.value)}
            placeholder="Content slug"
            className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm w-40"
          />
          <input
            type="text"
            value={newExerciseTitle}
            onChange={(e) => setNewExerciseTitle(e.target.value)}
            placeholder="Title (optional)"
            className="px-3 py-2 border border-[var(--divider)] rounded-bento text-sm w-48"
          />
          <button type="button" onClick={addExercise} className="px-3 py-2 rounded-bento bg-primary text-white text-sm">
            Add exercise
          </button>
        </div>
      </section>

      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Vocabulary</h3>
        <div className="flex items-center gap-2 mb-2">
          <select value={contentLLM} onChange={(e) => setContentLLM(e.target.value as "deepseek" | "gemini")} className="text-sm border rounded px-2 py-1">
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Gemini</option>
          </select>
          <button type="button" onClick={generateVocabList} disabled={vocabLoading || !lessonTitle} className="text-primary text-sm hover:underline disabled:opacity-60">
            {vocabLoading ? "Generating…" : "Generate vocab list (AI)"}
          </button>
        </div>
        {generatedVocab && generatedVocab.length > 0 && (
          <div className="mb-2 p-2 bg-[var(--divider)]/20 rounded text-sm">
            <p className="text-secondary text-xs mb-1">Generated (use as reference or add vocabulary content and link above):</p>
            <ul className="space-y-0.5">
              {generatedVocab.map((v, i) => (
                <li key={i}>{v.word} — {v.reading} — {v.meaning}</li>
              ))}
            </ul>
          </div>
        )}
        <ul className="space-y-1 mb-2">
          {vocab.map((v) => (
            <li key={v.id} className="flex items-center gap-2 text-sm">
              <span className="text-charcoal">{v.word ?? v.reading ?? v.vocabulary_id.slice(0, 8)}</span>
              {v.meaning && <span className="text-secondary">— {v.meaning}</span>}
              <button type="button" onClick={() => removeLink("vocabulary", v.id)} className="text-red-600 hover:underline text-xs">
                Remove
              </button>
            </li>
          ))}
        </ul>
        {pickerType === "vocab" ? (
          <div className="space-y-1">
            <input
              type="text"
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              placeholder="Search vocabulary…"
              className="w-full px-3 py-2 border rounded-bento text-sm"
            />
            <ul className="border rounded-bento max-h-40 overflow-auto">
              {pickerOptions.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => addLink("vocabulary", o.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--divider)]/30">
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setPickerType(null)} className="text-secondary text-xs">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setPickerType("vocab")} className="text-primary text-sm hover:underline">+ Add vocabulary</button>
        )}
      </section>

      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Grammar</h3>
        <ul className="space-y-1 mb-2">
          {grammar.map((g) => (
            <li key={g.id} className="flex items-center gap-2 text-sm">
              <span className="text-charcoal">{g.pattern ?? g.structure ?? g.grammar_id.slice(0, 8)}</span>
              <button type="button" onClick={() => removeLink("grammar", g.id)} className="text-red-600 hover:underline text-xs">Remove</button>
            </li>
          ))}
        </ul>
        {pickerType === "grammar" ? (
          <div className="space-y-1">
            <input type="text" value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Search grammar…" className="w-full px-3 py-2 border rounded-bento text-sm" />
            <ul className="border rounded-bento max-h-40 overflow-auto">
              {pickerOptions.map((o) => (
                <li key={o.id}><button type="button" onClick={() => addLink("grammar", o.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--divider)]/30">{o.label}</button></li>
              ))}
            </ul>
            <button type="button" onClick={() => setPickerType(null)} className="text-secondary text-xs">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setPickerType("grammar")} className="text-primary text-sm hover:underline">+ Add grammar</button>
        )}
      </section>

      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Kanji</h3>
        <ul className="space-y-1 mb-2">
          {kanji.map((k) => (
            <li key={k.id} className="flex items-center gap-2 text-sm">
              <span className="text-charcoal">{k.character ?? k.kanji_id.slice(0, 8)}</span>
              {k.meaning && <span className="text-secondary">— {k.meaning}</span>}
              <button type="button" onClick={() => removeLink("kanji", k.id)} className="text-red-600 hover:underline text-xs">Remove</button>
            </li>
          ))}
        </ul>
        {pickerType === "kanji" ? (
          <div className="space-y-1">
            <input type="text" value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Search kanji…" className="w-full px-3 py-2 border rounded-bento text-sm" />
            <ul className="border rounded-bento max-h-40 overflow-auto">
              {pickerOptions.map((o) => (
                <li key={o.id}><button type="button" onClick={() => addLink("kanji", o.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--divider)]/30">{o.label}</button></li>
              ))}
            </ul>
            <button type="button" onClick={() => setPickerType(null)} className="text-secondary text-xs">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setPickerType("kanji")} className="text-primary text-sm hover:underline">+ Add kanji</button>
        )}
      </section>

      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Kana</h3>
        <ul className="space-y-1 mb-2">
          {kana.map((k) => (
            <li key={k.id} className="flex items-center gap-2 text-sm">
              <span className="text-charcoal">{k.character}</span>
              <span className="text-secondary">({k.romaji})</span>
              <button type="button" onClick={() => removeLink("kana", k.id)} className="text-red-600 hover:underline text-xs">Remove</button>
            </li>
          ))}
        </ul>
        {pickerType === "kana" ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <select value={kanaPickerType} onChange={(e) => setKanaPickerType(e.target.value as "hiragana" | "katakana")} className="text-sm border rounded px-2 py-1">
                <option value="hiragana">Hiragana</option>
                <option value="katakana">Katakana</option>
              </select>
              <input type="text" value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Search (char or romaji)" className="flex-1 px-3 py-2 border rounded-bento text-sm" />
            </div>
            <ul className="border rounded-bento max-h-40 overflow-auto">
              {pickerOptions.map((o) => (
                <li key={o.id}><button type="button" onClick={() => addLink("kana", o.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--divider)]/30">{o.label}</button></li>
              ))}
            </ul>
            <button type="button" onClick={() => setPickerType(null)} className="text-secondary text-xs">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setPickerType("kana"); setPickerQ(""); }} className="text-primary text-sm hover:underline">+ Add kana</button>
        )}
      </section>

      <section>
        <h3 className="font-heading font-semibold text-charcoal mb-2">Examples</h3>
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={generateExamples} disabled={examplesLoading || !lessonTitle} className="text-primary text-sm hover:underline disabled:opacity-60">
            {examplesLoading ? "Generating…" : "Generate examples (AI)"}
          </button>
        </div>
        <ul className="space-y-2 mb-3">
          {examples.map((ex) => (
            <li key={ex.id} className="text-sm border-l-2 border-[var(--divider)] pl-3">
              <p className="text-charcoal">{ex.sentence_ja}</p>
              {ex.sentence_romaji && <p className="text-secondary text-xs">{ex.sentence_romaji}</p>}
              <p className="text-charcoal">{ex.sentence_en}</p>
              <button type="button" onClick={() => deleteExample(ex.id)} className="text-red-600 hover:underline text-xs mt-1">Delete</button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2">
          <input value={exampleForm.sentence_ja} onChange={(e) => setExampleForm((f) => ({ ...f, sentence_ja: e.target.value }))} placeholder="Sentence (JA)" className="px-3 py-2 border rounded-bento text-sm" />
          <input value={exampleForm.sentence_romaji} onChange={(e) => setExampleForm((f) => ({ ...f, sentence_romaji: e.target.value }))} placeholder="Romaji (optional)" className="px-3 py-2 border rounded-bento text-sm" />
          <input value={exampleForm.sentence_en} onChange={(e) => setExampleForm((f) => ({ ...f, sentence_en: e.target.value }))} placeholder="Sentence (EN)" className="px-3 py-2 border rounded-bento text-sm" />
          <input value={exampleForm.notes} onChange={(e) => setExampleForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="px-3 py-2 border rounded-bento text-sm" />
          <button type="button" onClick={addExample} className="btn-primary text-sm">Add example</button>
        </div>
      </section>
    </div>
  );
}
