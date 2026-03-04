const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

function normalizeLevel(level: string): string {
  const l = (level || "").toLowerCase();
  if (l === "all" || !l) return "all";
  const upper = l.toUpperCase();
  return LEVELS.includes(upper as (typeof LEVELS)[number]) ? l : "all";
}

function matchesLevel(itemLevel: string | null, filterLevel: string): boolean {
  if (filterLevel === "all") return true;
  if (!itemLevel) return false;
  return itemLevel.toUpperCase() === filterLevel.toUpperCase();
}

function matchesCategory(itemType: string, filterCategory: string): boolean {
  if (filterCategory === "all") return true;
  const typeNorm = itemType?.toLowerCase() || "";
  if (filterCategory === "vocab") return typeNorm === "vocabulary";
  return typeNorm === filterCategory.toLowerCase();
}

function matchesSearch(title: string, content: string, tags: string[], q: string): boolean {
  if (!q || !q.trim()) return true;
  const lower = q.toLowerCase().trim();
  return (
    (title || "").toLowerCase().includes(lower) ||
    (content || "").toLowerCase().includes(lower) ||
    tags.some((t) => String(t).toLowerCase().includes(lower))
  );
}

export type LearnItemForFilter = {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  content_type: string;
  jlpt_level: string | null;
  tags: string[] | null;
  meta: Record<string, unknown> | null;
  status: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

/** All valid learning_content content_type values. Single source of truth for routes and API. */
export const LEARN_CONTENT_TYPES = [
  "grammar",
  "vocabulary",
  "kanji",
  "reading",
  "writing",
  "listening",
  "sounds",
  "study_guide",
  "practice_test",
] as const;

export type LearnContentType = (typeof LEARN_CONTENT_TYPES)[number];

export const LEARN_TYPE_LABELS: Record<LearnContentType, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  sounds: "Sounds",
  study_guide: "Study guide",
  practice_test: "Practice test",
};

export const LEARN_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "grammar", label: "Grammar" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "kanji", label: "Kanji" },
  { id: "reading", label: "Reading" },
  { id: "writing", label: "Writing" },
  { id: "listening", label: "Listening" },
  { id: "sounds", label: "Sounds" },
  { id: "study_guide", label: "Study guide" },
  { id: "practice_test", label: "Practice test" },
  { id: "roadmap", label: "Roadmap" },
  { id: "tips", label: "Tips" },
] as const;

export const LEARN_LEVELS = ["all", "n5", "n4", "n3", "n2", "n1"] as const;
export type LearnLevel = (typeof LEARN_LEVELS)[number];

export function normalizeLearnLevel(level: string): LearnLevel {
  const l = normalizeLevel(level);
  if (l === "all") return "all";
  return l as LearnLevel;
}

function normalizeTags(tags: string[] | null | unknown): string[] {
  if (Array.isArray(tags)) return tags.map((t) => String(t ?? ""));
  if (typeof tags === "string") return tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return [];
}

export function filterLearnItems(
  items: LearnItemForFilter[],
  level: string,
  category: string,
  search: string
): LearnItemForFilter[] {
  return items.filter((item) => {
    const tags = normalizeTags(item.tags);
    return (
      matchesLevel(item.jlpt_level, level) &&
      matchesCategory(item.content_type, category) &&
      matchesSearch(item.title || "", item.content || "", tags, search)
    );
  });
}

export function getSummary(item: LearnItemForFilter, maxLen = 120): string {
  const meta = item.meta as { summary?: string } | null;
  if (meta?.summary && typeof meta.summary === "string") return meta.summary;
  const text = (item.content || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "…";
}
