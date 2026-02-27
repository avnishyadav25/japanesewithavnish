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

export const LEARN_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "grammar", label: "Grammar" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "kanji", label: "Kanji" },
  { id: "reading", label: "Reading" },
  { id: "writing", label: "Writing" },
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

export function filterLearnItems(
  items: LearnItemForFilter[],
  level: string,
  category: string,
  search: string
): LearnItemForFilter[] {
  return items.filter((item) => {
    const tags = (item.tags || []) as string[];
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
