const LEVELS = (l: unknown): string[] =>
  Array.isArray(l) ? l.map((x) => String(x).toUpperCase()) : l ? [String(l).toUpperCase()] : [];

function matchesLevel(
  postLevels: string[],
  filterLevel: string
): boolean {
  if (filterLevel === "all") return true;
  if (filterLevel === "mega") {
    return postLevels.some((pl) => ["N5", "N4", "N3", "N2", "N1"].includes(pl));
  }
  return postLevels.includes(filterLevel.toUpperCase());
}

function matchesType(postTags: string[], filterType: string): boolean {
  if (filterType === "all") return true;
  const typeNorm = filterType === "vocab" ? "vocabulary" : filterType;
  return postTags.some((t) => t.toLowerCase().includes(typeNorm));
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
};

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
      matchesType(tags, type) &&
      matchesSearch(p.title || "", p.summary || "", tags, search)
    );
  });
}
