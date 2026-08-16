/**
 * Free-text topics — "birds in Japanese", "numbers", "family" — turned into a real item list.
 *
 * WHY THIS IS NOT A LIKE QUERY. Measured against this database:
 *
 *   term    ILIKE '%term%'    ~* '\yterm\y'
 *   cat     96                2          (category, indicate, educate, catch)
 *   one     240               114        (money, phone, alone, done)
 *   hand    32                15         (handle, shorthand)
 *
 * Word boundaries remove most of it. What they cannot remove is meaning: an expanded bird set
 * still matches 俯瞰 "bird's-eye view" and 縮める "to duck (one's head)". So the matcher's job is
 * to produce CANDIDATES, and a human confirms them. Nothing here writes a video by itself.
 *
 * The second measured fact that shapes this: the library is thin on themes. Searching published
 * content finds 3 birds, 2 cats, 4 greetings. Most of a topic video is therefore newly written,
 * which is why LLM-authored words become draft posts rather than living only inside a storyboard.
 */
import { sql } from "@/lib/db";
import { callDeepSeekJson, deepSeekConfigured, parseJsonResponse } from "@/lib/ai/deepseek";
import { publicUrlFor } from "./scopeResolver";

/**
 * Themes worth having a video for, with their search terms curated rather than LLM-expanded.
 *
 * The content plan renders all of these on every load. Expanding fifteen topics through DeepSeek
 * per page view would be slow, cost money to look at a dashboard, and — worse — make the coverage
 * numbers non-deterministic, so the same page would report different gaps on two refreshes.
 * Ad-hoc topics typed into the wizard still get the LLM; a fixed list does not need it.
 */
export const THEME_TERMS: Record<string, string[]> = {
  numbers: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "hundred", "thousand", "number", "count"],
  greetings: ["hello", "goodbye", "good morning", "good evening", "thank you", "sorry", "excuse me", "please", "welcome", "greeting"],
  family: ["mother", "father", "sister", "brother", "grandmother", "grandfather", "aunt", "uncle", "cousin", "parent", "child", "family", "wife", "husband", "son", "daughter"],
  "body parts": ["head", "hand", "foot", "eye", "ear", "nose", "mouth", "arm", "leg", "finger", "hair", "face", "shoulder", "knee", "heart", "stomach", "tooth", "body"],
  animals: ["dog", "cat", "horse", "cow", "pig", "sheep", "monkey", "rabbit", "mouse", "bear", "fox", "tiger", "elephant", "animal"],
  birds: ["bird", "sparrow", "crow", "pigeon", "chicken", "duck", "owl", "eagle", "hawk", "crane", "swan"],
  colours: ["red", "blue", "green", "yellow", "black", "white", "brown", "purple", "orange", "pink", "grey", "gray", "colour", "color"],
  "food and drink": ["rice", "bread", "meat", "fish", "vegetable", "fruit", "water", "tea", "coffee", "milk", "egg", "soup", "noodle", "food", "drink", "meal"],
  "days and time": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow", "yesterday", "morning", "evening", "night", "week", "month", "year", "hour", "minute"],
  weather: ["rain", "snow", "wind", "cloud", "sun", "hot", "cold", "warm", "cool", "storm", "weather", "temperature"],
  jobs: ["teacher", "doctor", "nurse", "student", "engineer", "lawyer", "cook", "driver", "farmer", "police", "job", "work", "company"],
  travel: ["train", "bus", "car", "airplane", "station", "airport", "ticket", "hotel", "map", "road", "travel", "trip", "luggage"],
  school: ["school", "teacher", "student", "class", "lesson", "homework", "test", "pencil", "notebook", "library", "university", "study"],
  clothes: ["shirt", "trousers", "pants", "skirt", "dress", "shoe", "hat", "coat", "jacket", "sock", "clothes", "wear"],
  emotions: ["happy", "sad", "angry", "afraid", "surprised", "tired", "lonely", "excited", "worried", "emotion", "feeling"],
};

export const THEME_TOPICS = Object.keys(THEME_TERMS);

export interface TopicCandidate {
  /** Absent for an LLM-authored suggestion that has no post yet. */
  postId?: string;
  contentType: string;
  title: string;
  /** The Japanese word/pattern/character. */
  word?: string;
  reading?: string;
  meaning?: string;
  jlptLevel?: string;
  slug?: string;
  url?: string;
  /** `library` came from published content; `llm` was written just now and is unreviewed. */
  source: "library" | "llm";
  /** Which expanded term matched, so a wrong match is traceable to its cause. */
  matchedTerm?: string;
}

/**
 * Turns a topic into the concept terms a search can actually match.
 *
 * "birds in Japanese" alone matches almost nothing — the meanings in the database are "sparrow",
 * "crow", "chicken", not "bird". Expansion is the difference between 3 candidates and a usable
 * set, and it is cheap: one small DeepSeek call, ~200 tokens.
 */
export async function expandTopic(topic: string, limit = 24): Promise<string[]> {
  const cleaned = topic.trim();
  if (!cleaned) return [];
  if (!deepSeekConfigured()) return fallbackTerms(cleaned);

  try {
    const res = await callDeepSeekJson({
      systemPrompt:
        "You expand a topic into the English words whose Japanese translations belong to it. " +
        "Return JSON {\"terms\": string[]}. Use singular, lowercase, single English words or short " +
        "noun phrases that would appear in a dictionary definition. For \"birds\" return sparrow, " +
        "crow, pigeon, chicken, duck, owl, eagle — not \"bird species\" or \"avian\". " +
        `Return at most ${limit} terms. No Japanese, no explanations.`,
      userMessage: `Topic: ${cleaned}`,
      maxTokens: 400,
      temperature: 0.3,
      timeoutMs: 20_000,
    });
    const result = parseJsonResponse<{ terms?: string[] }>(res.text);

    const terms = (result?.terms ?? [])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 1 && t.length < 40);

    // Always include the topic's own words: an expansion that drops "bird" would miss 鳥 itself.
    return dedupe([...fallbackTerms(cleaned), ...terms]).slice(0, limit);
  } catch {
    return fallbackTerms(cleaned);
  }
}

/** The topic's own significant words, used alone when DeepSeek is unavailable or errors. */
function fallbackTerms(topic: string): string[] {
  const stop = new Set(["in", "the", "a", "an", "of", "and", "japanese", "japan", "words", "vocabulary", "for"]);
  return dedupe(
    topic
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !stop.has(w))
  );
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)));
}

/**
 * Escapes a term for use inside a POSIX regex alternation.
 *
 * Without this, a term containing "(" from a sloppy expansion produces an invalid regex and the
 * whole query throws — turning one bad suggestion into a failed search.
 */
function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary search across the sidecar tables that carry an English meaning.
 *
 * Only vocabulary, kanji and grammar are searched: they are the types with a `meaning` column and
 * bespoke scene templates. reading/listening/writing carry a title and level, which a thematic
 * search cannot match on usefully.
 */
export async function matchTopicItems(
  terms: string[],
  opts: { jlptLevel?: string; limit?: number } = {}
): Promise<TopicCandidate[]> {
  if (!sql || terms.length === 0) return [];

  const pattern = `\\y(${terms.map(escapeRegex).join("|")})\\y`;
  const limit = opts.limit ?? 60;
  const level = opts.jlptLevel ?? null;

  const rows = (await sql`
    SELECT * FROM (
      SELECT p.id, p.slug, p.title, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             v.word, v.reading, v.meaning
      FROM vocabulary v JOIN posts p ON p.id = v.post_id
      WHERE p.status = 'published' AND v.meaning ~* ${pattern}
      UNION ALL
      -- kunyomi is TEXT[] while vocabulary.reading is TEXT, and a UNION will not coerce them.
      -- Joined to a single string here rather than widening the result type, since the caller
      -- only ever displays this.
      SELECT p.id, p.slug, p.title, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             k.character AS word, array_to_string(k.kunyomi, ', ') AS reading, k.meaning
      FROM kanji k JOIN posts p ON p.id = k.post_id
      WHERE p.status = 'published' AND k.meaning ~* ${pattern}
      UNION ALL
      SELECT p.id, p.slug, p.title, p.content_type, (p.jlpt_level)[1] AS jlpt_level,
             g.pattern AS word, g.pattern_romaji AS reading, g.meaning
      FROM grammar g JOIN posts p ON p.id = g.post_id
      WHERE p.status = 'published' AND g.meaning ~* ${pattern}
    ) hits
    WHERE (${level}::text IS NULL OR hits.jlpt_level = ${level})
    ORDER BY
      -- Pedagogical order, NOT alphabetical. Sorting the level string put N1 first, so a
      -- "birds" search returned 鳩 鶏 鶴 鷹 — all N1 kanji — to a site whose audience is
      -- overwhelmingly beginners. N5 first is the whole point.
      CASE hits.jlpt_level WHEN 'N5' THEN 1 WHEN 'N4' THEN 2 WHEN 'N3' THEN 3
                           WHEN 'N2' THEN 4 WHEN 'N1' THEN 5 ELSE 6 END,
      -- Then by how tightly the meaning matches. A word whose whole definition is "chicken" is
      -- about chickens; one reading "to roll up; to enfold; to swallow up; to involve" merely
      -- contains a bird's name by accident. Definition length is a crude proxy that happens to
      -- separate those two cases well, and the human confirm step catches what it misses.
      length(COALESCE(hits.meaning, '')),
      hits.title
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return rows.map((r) => {
    const contentType = String(r.content_type);
    const slug = String(r.slug);
    const meaning = (r.meaning as string | null) ?? undefined;
    return {
      postId: String(r.id),
      contentType,
      title: String(r.title),
      word: (r.word as string | null) ?? undefined,
      reading: (r.reading as string | null) ?? undefined,
      meaning,
      jlptLevel: (r.jlpt_level as string | null) ?? undefined,
      slug,
      url: publicUrlFor(contentType, slug),
      source: "library" as const,
      matchedTerm: terms.find((t) => new RegExp(`\\b${escapeRegex(t)}\\b`, "i").test(meaning ?? "")),
    };
  });
}

export interface ThemeCoverage {
  theme: string;
  /** Published items whose meaning matches one of the theme's terms. */
  available: number;
  /** Of those, how many have appeared in a video. */
  withVideo: number;
}

/**
 * How well each theme is covered, for the content plan.
 *
 * "Has a video" uses the same definition as the JLPT coverage matrix on that page — the item
 * appears in the content snapshot of a storyboard whose project has a current, non-rejected
 * render — so the two tables on one screen cannot disagree about what covered means.
 *
 * One query for all fifteen themes rather than fifteen queries: this runs on page load.
 */
export async function getThemeCoverage(): Promise<ThemeCoverage[]> {
  if (!sql) return [];

  const themes = Object.keys(THEME_TERMS);
  const patterns = themes.map((t) => `\\y(${THEME_TERMS[t].map(escapeRegex).join("|")})\\y`);

  const rows = (await sql`
    WITH themes AS (
      SELECT * FROM unnest(${themes}::text[], ${patterns}::text[]) AS t(theme, pattern)
    ),
    meanings AS (
      SELECT p.id, v.meaning FROM vocabulary v JOIN posts p ON p.id = v.post_id WHERE p.status = 'published'
      UNION ALL
      SELECT p.id, k.meaning FROM kanji k JOIN posts p ON p.id = k.post_id WHERE p.status = 'published'
    ),
    covered AS (
      SELECT DISTINCT p.id AS post_id
      FROM video_storyboards s
      JOIN video_renders r ON r.project_id = s.project_id AND r.is_current AND r.approval_status <> 'rejected'
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.content_snapshot->'items', '[]'::jsonb)) AS item
      JOIN posts p ON (item->>'postId' IS NOT NULL AND p.id = (item->>'postId')::uuid)
    )
    SELECT t.theme,
           COUNT(DISTINCT m.id)::int AS available,
           COUNT(DISTINCT c.post_id)::int AS with_video
    FROM themes t
    LEFT JOIN meanings m ON m.meaning ~* t.pattern
    LEFT JOIN covered c ON c.post_id = m.id
    GROUP BY t.theme
  `) as Record<string, unknown>[];

  const byTheme = new Map(rows.map((r) => [String(r.theme), r]));
  // Ordered by the declaration order of THEME_TERMS, not by the database's grouping order, so
  // the table does not reshuffle between page loads.
  return themes.map((theme) => {
    const r = byTheme.get(theme);
    return {
      theme,
      available: r ? Number(r.available) : 0,
      withVideo: r ? Number(r.with_video) : 0,
    };
  });
}

export interface ProposedWord {
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  jlptLevel: string;
  partOfSpeech?: string;
  exampleJa?: string;
  exampleRomaji?: string;
  exampleEn?: string;
}

/**
 * Asks DeepSeek for the words a topic needs that the library does not have.
 *
 * Given what it is told to avoid, this is the bulk of most topics — see the counts in the module
 * docstring. The prompt inherits the same hard rule the social prompts use: if a reading or a
 * particle is uncertain, leave the word out. A wrong reading in a video is worse than a short one.
 */
export async function proposeTopicWords(params: {
  topic: string;
  jlptLevel?: string;
  have: string[];
  count: number;
}): Promise<ProposedWord[]> {
  if (!deepSeekConfigured() || params.count <= 0) return [];

  const res = await callDeepSeekJson({
    systemPrompt:
      "You choose Japanese vocabulary for a lesson video, for a JLPT-focused site whose learners " +
      "are mostly beginners.\n\n" +
      "Return JSON {\"words\": [{word, reading, romaji, meaning, jlptLevel, partOfSpeech, " +
      "exampleJa, exampleRomaji, exampleEn}]}.\n\n" +
      "HARD RULES\n" +
      "- `word` is the Japanese as normally written (kanji where a learner would see kanji).\n" +
      "- `reading` is kana only. `romaji` is Hepburn.\n" +
      "- If you are not certain of a reading, a particle or a counter, LEAVE THE WORD OUT. A wrong " +
      "reading burned into a video is worse than a shorter video.\n" +
      "- jlptLevel is one of N5, N4, N3, N2, N1 — the level a learner would actually meet it at.\n" +
      "- Everyday, useful words first. No archaic or literary vocabulary.\n" +
      "- The example sentence must use the word and be within one level of it.",
    userMessage:
      `Topic: ${params.topic}\n` +
      (params.jlptLevel ? `Target level: ${params.jlptLevel}\n` : "") +
      `Give exactly ${params.count} words.\n` +
      (params.have.length > 0
        ? `Already covered, do NOT repeat these: ${params.have.join(", ")}`
        : "Nothing is covered yet."),
    maxTokens: 2200,
    temperature: 0.4,
    timeoutMs: 45_000,
  });
  const result = parseJsonResponse<{ words?: ProposedWord[] }>(res.text);

  return (result?.words ?? [])
    .filter((w) => w && typeof w.word === "string" && typeof w.meaning === "string")
    .slice(0, params.count);
}
