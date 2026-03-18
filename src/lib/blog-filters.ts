const LEVELS = (l: unknown): string[] =>
  Array.isArray(l) ? l.map((x) => String(x).toUpperCase()) : l ? [String(l).toUpperCase()] : [];

function parseLevels(value: string): string[] {
  if (!value || value === "all") return [];
  return value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

function parseTypes(value: string): string[] {
  if (!value || value === "all") return [];
  return value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function matchesLevel(postLevels: string[], filterLevel: string): boolean {
  const selected = parseLevels(filterLevel);
  if (selected.length === 0) return true;
  return postLevels.some((pl) => selected.includes(pl));
}

function matchesType(
  postTags: string[],
  filterType: string,
  contentType: string | null | undefined
): boolean {
  const selected = parseTypes(filterType);
  if (selected.length === 0) return true;
  const contentTypeNorm = (contentType ?? "").toLowerCase();
  if (contentTypeNorm && selected.includes(contentTypeNorm)) return true;
  return postTags.some((t) => selected.some((s) => (t ?? "").toLowerCase().includes(s === "vocabulary" ? "vocab" : s)));
}

function matchesSearch(
  title: string,
  summary: string,
  tags: string[],
  q: string
): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    (title || "").toLowerCase().includes(lower) ||
    (summary || "").toLowerCase().includes(lower) ||
    tags.some((t) => t.toLowerCase().includes(lower))
  );
}

const LEARN_CONTENT_TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing", "listening", "sounds", "study_guide", "practice_test"] as const;

export type PostForFilter = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  jlpt_level?: unknown;
  tags?: string[] | null;
  published_at?: string | null;
  og_image_url?: string | null;
  seo_description?: string | null;
  content_type?: string | null;
};

export function isLearnContent(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return LEARN_CONTENT_TYPES.includes(contentType.toLowerCase() as (typeof LEARN_CONTENT_TYPES)[number]);
}

export function filterPosts(
  posts: PostForFilter[],
  level: string,
  type: string,
  search: string
): PostForFilter[] {
  return posts.filter((p) => {
    const postLevels = LEVELS(p.jlpt_level);
    const tags = (p.tags || []) as string[];
    return (
      matchesLevel(postLevels, level) &&
      matchesType(tags, type, p.content_type) &&
      matchesSearch(p.title || "", p.summary || "", tags, search)
    );
  });
}
