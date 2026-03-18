"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Level = { id: string; code: string; name: string; sort_order: number };
type Module = { id: string; level_id: string; code: string; title: string; sort_order: number };
type Submodule = { id: string; module_id: string; code: string; title: string; sort_order: number };
type Lesson = { id: string; submodule_id: string; code: string; title: string; goal: string | null; introduction: string | null; sort_order: number };

// Tree shape (from /api/learn/curriculum?path=1) for list view
type TreeExercise = { id: string; content_slug: string; post_id: string | null; sort_order: number; title?: string | null };
type TreeLesson = { id: string; code: string; title: string; sort_order: number; estimated_minutes?: number; feature_image_url?: string; exercises: TreeExercise[] };
type TreeSubmodule = { id: string; code: string; title: string; sort_order: number; feature_image_url?: string; lessons: TreeLesson[] };
type TreeModule = { id: string; code: string; title: string; sort_order: number; feature_image_url?: string; submodules: TreeSubmodule[] };
type TreeLevel = { id: string; code: string; name: string; sort_order: number; feature_image_url?: string; modules: TreeModule[] };
type CurriculumTreeResponse = { levels: TreeLevel[] };

function ListViewCircleIcon({ size = 6, imageUrl }: { size?: number; imageUrl?: string | null }) {
  const s = size * 4;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 overflow-hidden"
      style={{ width: s, height: s }}
      aria-hidden
    >
      {imageUrl?.trim() ? (
        <img src={imageUrl} alt="" width={s} height={s} className="w-full h-full object-cover" />
      ) : (
        <img src="/icon-learning.svg" alt="" width={size * 2.5} height={size * 2.5} className="opacity-90" />
      )}
    </span>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function CurriculumAdminClient() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedSubmoduleId, setSelectedSubmoduleId] = useState<string | null>(null);
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);
  const [showAddSubmodule, setShowAddSubmodule] = useState(false);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [createError, setCreateError] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [treeData, setTreeData] = useState<CurriculumTreeResponse | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [collapsedLevelIds, setCollapsedLevelIds] = useState<Set<string>>(new Set());
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(new Set());
  const [collapsedSubmoduleIds, setCollapsedSubmoduleIds] = useState<Set<string>>(new Set());
  const [collapsedLessonIds, setCollapsedLessonIds] = useState<Set<string>>(new Set());

  const loadLevels = useCallback(async () => {
    const data = await fetchJson<Level[]>("/api/admin/curriculum/levels");
    setLevels(data);
  }, []);

  useEffect(() => {
    loadLevels().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [loadLevels]);

  useEffect(() => {
    setTreeLoading(true);
    fetch("/api/learn/curriculum?path=1")
      .then((r) => r.json())
      .then((d) => {
        setTreeData(d?.levels?.length ? d : null);
        setCollapsedLevelIds(new Set());
        setCollapsedModuleIds(new Set());
        setCollapsedSubmoduleIds(new Set());
        setCollapsedLessonIds(new Set());
      })
      .catch(() => setTreeData(null))
      .finally(() => setTreeLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLevelId) {
      setModules([]);
      return;
    }
    fetchJson<Module[]>(`/api/admin/curriculum/modules?levelId=${selectedLevelId}`)
      .then(setModules)
      .catch(() => setModules([]));
  }, [selectedLevelId]);

  useEffect(() => {
    if (!selectedModuleId) {
      setSubmodules([]);
      return;
    }
    fetchJson<Submodule[]>(`/api/admin/curriculum/submodules?moduleId=${selectedModuleId}`)
      .then(setSubmodules)
      .catch(() => setSubmodules([]));
  }, [selectedModuleId]);

  useEffect(() => {
    if (!selectedSubmoduleId) {
      setLessons([]);
      return;
    }
    fetchJson<Lesson[]>(`/api/admin/curriculum/lessons?submoduleId=${selectedSubmoduleId}`)
      .then(setLessons)
      .catch(() => setLessons([]));
  }, [selectedSubmoduleId]);

  async function createLevel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError("");
    const form = e.currentTarget;
    const code = (form.elements.namedItem("levelCode") as HTMLInputElement).value.trim();
    const name = (form.elements.namedItem("levelName") as HTMLInputElement).value.trim();
    const sort_order = parseInt((form.elements.namedItem("levelSort") as HTMLInputElement).value, 10) || 0;
    const res = await fetch("/api/admin/curriculum/levels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, sort_order }) });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setShowAddLevel(false);
    loadLevels();
  }
  async function createModule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLevelId) return;
    setCreateError("");
    const form = e.currentTarget;
    const code = (form.elements.namedItem("moduleCode") as HTMLInputElement).value.trim();
    const title = (form.elements.namedItem("moduleTitle") as HTMLInputElement).value.trim();
    const sort_order = parseInt((form.elements.namedItem("moduleSort") as HTMLInputElement).value, 10) || 0;
    const res = await fetch("/api/admin/curriculum/modules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level_id: selectedLevelId, code, title, sort_order }) });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setShowAddModule(false);
    fetchJson<Module[]>(`/api/admin/curriculum/modules?levelId=${selectedLevelId}`).then(setModules);
  }
  async function createSubmodule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedModuleId) return;
    setCreateError("");
    const form = e.currentTarget;
    const code = (form.elements.namedItem("submoduleCode") as HTMLInputElement).value.trim();
    const title = (form.elements.namedItem("submoduleTitle") as HTMLInputElement).value.trim();
    const sort_order = parseInt((form.elements.namedItem("submoduleSort") as HTMLInputElement).value, 10) || 0;
    const res = await fetch("/api/admin/curriculum/submodules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module_id: selectedModuleId, code, title, sort_order }) });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setShowAddSubmodule(false);
    fetchJson<Submodule[]>(`/api/admin/curriculum/submodules?moduleId=${selectedModuleId}`).then(setSubmodules);
  }
  async function createLesson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSubmoduleId) return;
    setCreateError("");
    const form = e.currentTarget;
    const code = (form.elements.namedItem("lessonCode") as HTMLInputElement).value.trim();
    const title = (form.elements.namedItem("lessonTitle") as HTMLInputElement).value.trim();
    const sort_order = parseInt((form.elements.namedItem("lessonSort") as HTMLInputElement).value, 10) || 0;
    const res = await fetch("/api/admin/curriculum/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submodule_id: selectedSubmoduleId, code, title, sort_order }) });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error || "Failed"); return; }
    setShowAddLesson(false);
    fetchJson<Lesson[]>(`/api/admin/curriculum/lessons?submoduleId=${selectedSubmoduleId}`).then(setLessons);
  }

  function expandAllList() {
    setCollapsedLevelIds(new Set());
    setCollapsedModuleIds(new Set());
    setCollapsedSubmoduleIds(new Set());
    setCollapsedLessonIds(new Set());
  }
  function collapseAllList() {
    if (!treeData?.levels?.length) return;
    setCollapsedLevelIds(new Set(treeData.levels.map((l) => l.id)));
  }
  function toggleLevel(id: string) {
    setCollapsedLevelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleModule(id: string) {
    setCollapsedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSubmodule(id: string) {
    setCollapsedSubmoduleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleLesson(id: string) {
    setCollapsedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fetchSuggestNext() {
    setAiSuggestLoading(true);
    setAiSuggestions([]);
    setAiPanelOpen(true);
    try {
      const res = await fetch("/api/ai/curriculum/suggest-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelId: selectedLevelId ?? undefined,
          moduleId: selectedModuleId ?? undefined,
          submoduleId: selectedSubmoduleId ?? undefined,
          lessonId: undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.suggestions)) setAiSuggestions(data.suggestions);
    } finally {
      setAiSuggestLoading(false);
    }
  }

  if (loading) return <p className="text-secondary">Loading…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAiPanelOpen((o) => !o)}
          className="text-sm text-primary hover:underline"
        >
          {aiPanelOpen ? "Hide" : "Show"} AI suggestions
        </button>
        {aiPanelOpen && (
          <button
            type="button"
            onClick={fetchSuggestNext}
            disabled={aiSuggestLoading}
            className="text-sm btn-primary py-1 px-2 disabled:opacity-60"
          >
            {aiSuggestLoading ? "Loading…" : "Suggest next steps"}
          </button>
        )}
      </div>
      {aiPanelOpen && (
        <div className="rounded-bento border border-[var(--divider)] bg-[var(--divider)]/10 p-3 text-sm">
          {aiSuggestions.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-charcoal">
              {aiSuggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-secondary">Select a level (or module/submodule) and click &quot;Suggest next steps&quot; for AI suggestions.</p>
          )}
        </div>
      )}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-bento border border-[var(--divider)] bg-white p-4">
        <h2 className="font-heading font-semibold text-charcoal mb-3">Levels</h2>
        <ul className="space-y-1">
          {levels.map((l) => (
            <li key={l.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedLevelId(l.id);
                  setSelectedModuleId(null);
                  setSelectedSubmoduleId(null);
                }}
                className={`flex-1 text-left px-3 py-2 rounded text-sm transition ${selectedLevelId === l.id ? "bg-primary/15 text-primary font-medium" : "hover:bg-[var(--divider)]/30"}`}
              >
                {l.code} — {l.name}
              </button>
              <Link href={`/admin/learn/curriculum/levels/${l.id}`} className="text-primary text-xs hover:underline shrink-0 px-1">Edit</Link>
            </li>
          ))}
        </ul>
        {showAddLevel ? (
          <form onSubmit={createLevel} className="mt-2 space-y-2 text-sm">
            <input name="levelCode" placeholder="Code (e.g. N4)" className="w-full px-2 py-1 border rounded" required />
            <input name="levelName" placeholder="Name" className="w-full px-2 py-1 border rounded" required />
            <input name="levelSort" type="number" placeholder="Sort" defaultValue={0} className="w-20 px-2 py-1 border rounded" />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-xs">Add</button>
              <button type="button" onClick={() => setShowAddLevel(false)} className="text-secondary text-xs">Cancel</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setShowAddLevel(true)} className="mt-2 text-primary text-sm hover:underline">+ Add level</button>
        )}
        {levels.length === 0 && !showAddLevel && <p className="text-secondary text-sm mt-1">No levels. Run npm run seed:curriculum or add above.</p>}
      </div>

      <div className="rounded-bento border border-[var(--divider)] bg-white p-4">
        <h2 className="font-heading font-semibold text-charcoal mb-3">Modules</h2>
        {selectedLevelId ? (
          <>
            <ul className="space-y-1">
              {modules.map((m) => (
                <li key={m.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModuleId(m.id);
                      setSelectedSubmoduleId(null);
                    }}
                    className={`flex-1 text-left px-3 py-2 rounded text-sm transition ${selectedModuleId === m.id ? "bg-primary/15 text-primary font-medium" : "hover:bg-[var(--divider)]/30"}`}
                  >
                    {m.code} — {m.title}
                  </button>
                  <Link href={`/admin/learn/curriculum/modules/${m.id}`} className="text-primary text-xs hover:underline shrink-0 px-1">Edit</Link>
                </li>
              ))}
            </ul>
            {showAddModule ? (
              <form onSubmit={createModule} className="mt-2 space-y-2 text-sm">
                <input name="moduleCode" placeholder="Code" className="w-full px-2 py-1 border rounded" required />
                <input name="moduleTitle" placeholder="Title" className="w-full px-2 py-1 border rounded" required />
                <input name="moduleSort" type="number" placeholder="Sort" defaultValue={0} className="w-20 px-2 py-1 border rounded" />
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-xs">Add</button>
                  <button type="button" onClick={() => setShowAddModule(false)} className="text-secondary text-xs">Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setShowAddModule(true)} className="mt-2 text-primary text-sm hover:underline">+ Add module</button>
            )}
          </>
        ) : (
          <p className="text-secondary text-sm">Select a level</p>
        )}
      </div>

      <div className="rounded-bento border border-[var(--divider)] bg-white p-4">
        <h2 className="font-heading font-semibold text-charcoal mb-3">Submodules</h2>
        {selectedModuleId ? (
          <>
            <ul className="space-y-1">
              {submodules.map((s) => (
                <li key={s.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSubmoduleId(s.id)}
                    className={`flex-1 text-left px-3 py-2 rounded text-sm transition ${selectedSubmoduleId === s.id ? "bg-primary/15 text-primary font-medium" : "hover:bg-[var(--divider)]/30"}`}
                  >
                    {s.code} — {s.title}
                  </button>
                  <Link href={`/admin/learn/curriculum/submodules/${s.id}`} className="text-primary text-xs hover:underline shrink-0 px-1">Edit</Link>
                </li>
              ))}
            </ul>
            {showAddSubmodule ? (
              <form onSubmit={createSubmodule} className="mt-2 space-y-2 text-sm">
                <input name="submoduleCode" placeholder="Code" className="w-full px-2 py-1 border rounded" required />
                <input name="submoduleTitle" placeholder="Title" className="w-full px-2 py-1 border rounded" required />
                <input name="submoduleSort" type="number" placeholder="Sort" defaultValue={0} className="w-20 px-2 py-1 border rounded" />
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-xs">Add</button>
                  <button type="button" onClick={() => setShowAddSubmodule(false)} className="text-secondary text-xs">Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setShowAddSubmodule(true)} className="mt-2 text-primary text-sm hover:underline">+ Add submodule</button>
            )}
          </>
        ) : (
          <p className="text-secondary text-sm">Select a module</p>
        )}
      </div>

      <div className="rounded-bento border border-[var(--divider)] bg-white p-4">
        <h2 className="font-heading font-semibold text-charcoal mb-3">Lessons</h2>
        {selectedSubmoduleId ? (
          <>
            <ul className="space-y-1">
              {lessons.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/admin/learn/curriculum/lessons/${l.id}`}
                    className="block px-3 py-2 rounded text-sm hover:bg-[var(--divider)]/30 transition text-charcoal"
                  >
                    {l.code} — {l.title}
                  </Link>
                </li>
              ))}
            </ul>
            {showAddLesson ? (
              <form onSubmit={createLesson} className="mt-2 space-y-2 text-sm">
                <input name="lessonCode" placeholder="Code" className="w-full px-2 py-1 border rounded" required />
                <input name="lessonTitle" placeholder="Title" className="w-full px-2 py-1 border rounded" required />
                <input name="lessonSort" type="number" placeholder="Sort" defaultValue={0} className="w-20 px-2 py-1 border rounded" />
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-xs">Add</button>
                  <button type="button" onClick={() => setShowAddLesson(false)} className="text-secondary text-xs">Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setShowAddLesson(true)} className="mt-2 text-primary text-sm hover:underline">+ Add lesson</button>
            )}
          </>
        ) : (
          <p className="text-secondary text-sm">Select a submodule</p>
        )}
      </div>
      </div>
      {createError && <p className="col-span-full text-red-600 text-sm">{createError}</p>}

      {/* Curriculum list view — full width (same as blog list) */}
      <div className="space-y-4 w-full">
      <section className="mt-8 w-full max-w-full rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[var(--divider)] bg-[var(--base)]">
          <h2 className="font-heading font-semibold text-charcoal">Curriculum list view</h2>
          <div className="flex gap-2">
            <button type="button" onClick={expandAllList} className="text-sm text-primary hover:underline">
              Expand all
            </button>
            <button type="button" onClick={collapseAllList} className="text-sm text-secondary hover:underline">
              Collapse all
            </button>
          </div>
        </div>
        {treeLoading ? (
          <p className="p-4 text-secondary text-sm">Loading…</p>
        ) : treeData?.levels?.length ? (
          <div className="p-4 space-y-0">
            {treeData.levels.map((level) => {
              const levelCollapsed = collapsedLevelIds.has(level.id);
              return (
                <div key={level.id} className="py-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleLevel(level.id)}
                      className="flex items-center gap-2 py-2.5 px-3 rounded-bento text-left font-medium text-charcoal hover:bg-[var(--divider)]/20 transition shrink-0"
                      aria-expanded={!levelCollapsed}
                    >
                      <span className="w-5 text-center" aria-hidden>{levelCollapsed ? "+" : "−"}</span>
                    </button>
                    <span className="font-medium">{level.code} — {level.name}</span>
                    <Link href={`/admin/learn/curriculum/levels/${level.id}`} className="text-primary text-sm hover:underline ml-2">Edit</Link>
                  </div>
                  {!levelCollapsed && (
                    <div className="pl-6 ml-2 border-l-2 border-[var(--divider)] space-y-0">
                      {level.modules.map((mod) => {
                        const modCollapsed = collapsedModuleIds.has(mod.id);
                        return (
                          <div key={mod.id} className="py-0.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleModule(mod.id)}
                                className="flex items-center gap-2 py-2 px-3 rounded-bento text-left text-sm text-charcoal hover:bg-[var(--divider)]/15 transition shrink-0"
                                aria-expanded={!modCollapsed}
                              >
                                <span className="w-4 text-center text-secondary" aria-hidden>{modCollapsed ? "+" : "−"}</span>
                              </button>
                              <ListViewCircleIcon size={7} imageUrl={mod.feature_image_url} />
                              <span className="flex-1">Module {mod.code} — {mod.title}</span>
                              <Link href={`/admin/learn/curriculum/modules/${mod.id}`} className="text-primary text-xs hover:underline">Edit</Link>
                            </div>
                            {!modCollapsed && (
                              <div className="pl-4 ml-2 border-l-2 border-[var(--divider)]/70 space-y-0">
                                {mod.submodules.map((sub) => {
                                  const subCollapsed = collapsedSubmoduleIds.has(sub.id);
                                  return (
                                    <div key={sub.id} className="py-0.5">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleSubmodule(sub.id)}
                                          className="flex items-center gap-2 py-2 px-3 rounded-bento text-left text-sm shrink-0 hover:bg-[var(--divider)]/15 transition"
                                          aria-expanded={!subCollapsed}
                                        >
                                          <span className="w-4 text-center text-secondary" aria-hidden>{subCollapsed ? "+" : "−"}</span>
                                        </button>
                                        <ListViewCircleIcon size={6} imageUrl={sub.feature_image_url} />
                                        <span className="flex-1">Submodule {sub.code} — {sub.title}</span>
                                        <Link href={`/admin/learn/curriculum/submodules/${sub.id}`} className="text-primary text-xs hover:underline">Edit</Link>
                                      </div>
                                      {!subCollapsed && (
                                        <div className="pl-4 ml-2 border-l-2 border-[var(--divider)]/50 space-y-0">
                                          {sub.lessons.map((les) => {
                                            const lessonCollapsed = collapsedLessonIds.has(les.id);
                                            return (
                                              <div key={les.id} className="py-0.5">
                                                <div className="flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleLesson(les.id)}
                                                    className="flex items-center gap-2 py-2 px-3 rounded-bento text-left text-sm shrink-0 hover:bg-[var(--divider)]/15 transition"
                                                    aria-expanded={!lessonCollapsed}
                                                  >
                                                    <span className="w-4 text-center text-secondary" aria-hidden>{lessonCollapsed ? "+" : "−"}</span>
                                                  </button>
                                                  <ListViewCircleIcon size={5} imageUrl={les.feature_image_url} />
                                                  <span className="flex-1">Lesson {les.code} — {les.title}</span>
                                                  <Link href={`/admin/learn/curriculum/lessons/${les.id}`} className="text-primary text-xs hover:underline">Edit</Link>
                                                </div>
                                                {!lessonCollapsed && (
                                                  <div className="pl-4 ml-2 border-l-2 border-[var(--divider)]/40 py-2 space-y-1">
                                                    <span className="text-xs font-medium text-secondary uppercase tracking-wide">Exercises</span>
                                                    {les.exercises?.length ? (
                                                      <ul className="list-none space-y-1">
                                                        {les.exercises.map((ex) => (
                                                          <li key={ex.id} className="flex items-center gap-2 text-sm pl-2">
                                                            <span className="text-charcoal">{ex.title?.trim() || ex.content_slug || "Exercise"}</span>
                                                            <Link href={`/admin/learn/curriculum/lessons/${les.id}`} className="text-primary text-xs hover:underline">Edit (lesson)</Link>
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-secondary text-sm pl-2">No exercises yet.</p>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="p-4 text-secondary text-sm">No curriculum data. Run seed or add levels above.</p>
        )}
      </section>
    </div>
    </div>
  );
}
