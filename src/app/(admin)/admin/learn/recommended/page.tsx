import { sql } from "@/lib/db";
import { LearnRecommendedPageClient } from "./LearnRecommendedPageClient";

const LEVELS = ["all", "n5", "n4", "n3", "n2", "n1"] as const;

const PER_LEVEL = 6;

/** Build default recommended slugs from published learning_content (by level). */
function buildDefaultsFromDb(
  items: { slug: string; jlpt_level: string | null }[]
): Record<string, string[]> {
  const defaults: Record<string, string[]> = { all: [], n5: [], n4: [], n3: [], n2: [], n1: [] };
  for (const item of items) {
    const levelKey = (item.jlpt_level?.toUpperCase() || "").toLowerCase();
    if (defaults.all.length < PER_LEVEL) {
      defaults.all.push(item.slug);
    }
    if (levelKey && levelKey in defaults && defaults[levelKey].length < PER_LEVEL) {
      defaults[levelKey].push(item.slug);
    }
  }
  return defaults;
}

export default async function AdminLearnRecommendedPage() {
  let value: Record<string, string[]> = {};
  let defaultsFromDb: Record<string, string[]> = {
    all: [], n5: [], n4: [], n3: [], n2: [], n1: [],
  };

  if (sql) {
    const [settingsRows, contentRows] = await Promise.all([
      sql`SELECT value FROM site_settings WHERE key = 'learn_recommended' LIMIT 1`,
      sql`SELECT slug, (jlpt_level)[1] AS jlpt_level FROM posts WHERE status = 'published' AND content_type IN ('grammar','vocabulary','kanji','reading','writing','listening','sounds','study_guide','practice_test') ORDER BY sort_order ASC, created_at DESC LIMIT 300`,
    ]);
    const setting = (Array.isArray(settingsRows) ? settingsRows[0] : settingsRows) as { value?: Record<string, string[]> } | undefined;
    const raw = setting?.value;
    value = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, string[]>;
    const items = (Array.isArray(contentRows) ? contentRows : []) as { slug: string; jlpt_level: string | null }[];
    defaultsFromDb = buildDefaultsFromDb(items);
  }

  const initial: Record<string, string[]> = {};
  for (const level of LEVELS) {
    const saved = Array.isArray(value[level]) ? value[level] : [];
    const defaults = Array.isArray(defaultsFromDb[level]) ? defaultsFromDb[level] : [];
    initial[level] = saved.length > 0 ? saved : defaults;
  }

  return <LearnRecommendedPageClient initial={initial} />;
}
