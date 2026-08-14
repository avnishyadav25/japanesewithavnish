import { sql } from "@/lib/db";

export type WritingSet = {
  slug: string;
  title: string;
  type: "hiragana" | "katakana" | "kanji";
  chars: string[];
  desc: string;
  level: string;
};

// Kana is a fixed syllabary, so the row sets are static. Stroke-order data
// for every character lives in the kana table (KanjiVG backfill).
const ROW = (
  slug: string,
  title: string,
  type: "hiragana" | "katakana",
  chars: string,
  sounds: string
): WritingSet => ({
  slug,
  title,
  type,
  chars: Array.from(chars),
  desc: `Practice ${sounds} with correct stroke order tracing guides.`,
  level: "N5",
});

export const KANA_SETS: WritingSet[] = [
  ROW("hiragana-a-row", "Hiragana A Row", "hiragana", "あいうえお", "the vowels (A, I, U, E, O)"),
  ROW("hiragana-k-row", "Hiragana K Row", "hiragana", "かきくけこ", "KA, KI, KU, KE, KO"),
  ROW("hiragana-s-row", "Hiragana S Row", "hiragana", "さしすせそ", "SA, SHI, SU, SE, SO"),
  ROW("hiragana-t-row", "Hiragana T Row", "hiragana", "たちつてと", "TA, CHI, TSU, TE, TO"),
  ROW("hiragana-n-row", "Hiragana N Row", "hiragana", "なにぬねの", "NA, NI, NU, NE, NO"),
  ROW("hiragana-h-row", "Hiragana H Row", "hiragana", "はひふへほ", "HA, HI, FU, HE, HO"),
  ROW("hiragana-m-row", "Hiragana M Row", "hiragana", "まみむめも", "MA, MI, MU, ME, MO"),
  ROW("hiragana-y-row", "Hiragana Y Row", "hiragana", "やゆよ", "YA, YU, YO"),
  ROW("hiragana-r-row", "Hiragana R Row", "hiragana", "らりるれろ", "RA, RI, RU, RE, RO"),
  ROW("hiragana-w-row", "Hiragana W Row & N", "hiragana", "わをん", "WA, WO and N"),
  ROW("katakana-basics", "Katakana Basics", "katakana", "アイウエオ", "the vowels (A, I, U, E, O)"),
  ROW("katakana-k-row", "Katakana K Row", "katakana", "カキクケコ", "KA, KI, KU, KE, KO"),
  ROW("katakana-s-row", "Katakana S Row", "katakana", "サシスセソ", "SA, SHI, SU, SE, SO"),
  ROW("katakana-t-row", "Katakana T Row", "katakana", "タチツテト", "TA, CHI, TSU, TE, TO"),
  ROW("katakana-n-row", "Katakana N Row", "katakana", "ナニヌネノ", "NA, NI, NU, NE, NO"),
  ROW("katakana-h-row", "Katakana H Row", "katakana", "ハヒフヘホ", "HA, HI, FU, HE, HO"),
  ROW("katakana-m-row", "Katakana M Row", "katakana", "マミムメモ", "MA, MI, MU, ME, MO"),
  ROW("katakana-y-row", "Katakana Y Row", "katakana", "ヤユヨ", "YA, YU, YO"),
  ROW("katakana-r-row", "Katakana R Row", "katakana", "ラリルレロ", "RA, RI, RU, RE, RO"),
  ROW("katakana-w-row", "Katakana W Row & N", "katakana", "ワヲン", "WA, WO and N"),
];

const LEGACY_KANJI_SETS: WritingSet[] = [
  {
    slug: "basic-kanji-numbers",
    title: "Basic Kanji Numbers",
    type: "kanji",
    chars: Array.from("一二三四五六七八九十"),
    desc: "Learn and practice tracing basic numbers 1 through 10 in Kanji characters.",
    level: "N5",
  },
];

const KANJI_SET_SIZE = 10;

// Kanji rows without a jlpt_level are the advanced (N1) set.
async function kanjiCharsForLevel(level: string): Promise<string[]> {
  if (!sql) return [];
  const upper = level.toUpperCase();
  const rows = (upper === "N1"
    ? await sql`
        SELECT character FROM kanji
        WHERE jlpt_level = 'N1' OR jlpt_level IS NULL
        ORDER BY stroke_count NULLS LAST, character`
    : await sql`
        SELECT character FROM kanji
        WHERE jlpt_level = ${upper}
        ORDER BY stroke_count NULLS LAST, character`) as { character: string }[];
  return rows.map((r) => r.character).filter(Boolean);
}

function chunkToSets(chars: string[], level: string): WritingSet[] {
  const upper = level.toUpperCase();
  const sets: WritingSet[] = [];
  for (let i = 0; i < chars.length; i += KANJI_SET_SIZE) {
    const n = i / KANJI_SET_SIZE + 1;
    const slice = chars.slice(i, i + KANJI_SET_SIZE);
    sets.push({
      slug: `kanji-${level.toLowerCase()}-set-${n}`,
      title: `${upper} Kanji Set ${n}`,
      type: "kanji",
      chars: slice,
      desc: `Trace ${slice.length} ${upper} kanji (${slice.slice(0, 5).join("")}…) with stroke order guides.`,
      level: upper,
    });
  }
  return sets;
}

/** All writing sets for a level (kana sets are N5 only). "all" is the union of every real
 * per-level level's sets (not a re-chunked cross-level kanji list) — each set keeps its real
 * N5-N1 level/slug this way, so resolveWritingSet's slug lookup below still works unchanged. */
export async function getWritingSetsForLevel(level: string): Promise<WritingSet[]> {
  const upper = level.toUpperCase();
  if (upper === "ALL") {
    const perLevel = await Promise.all(["N5", "N4", "N3", "N2", "N1"].map((lv) => getWritingSetsForLevel(lv)));
    return perLevel.flat();
  }
  const kanjiSets = chunkToSets(await kanjiCharsForLevel(upper), upper);
  if (upper === "N5") return [...KANA_SETS, ...LEGACY_KANJI_SETS, ...kanjiSets];
  return kanjiSets;
}

/** Resolve a set by slug: static kana/legacy sets, or dynamic kanji-<level>-set-<n>. */
export async function resolveWritingSet(slug: string): Promise<WritingSet | null> {
  const staticSet = [...KANA_SETS, ...LEGACY_KANJI_SETS].find((s) => s.slug === slug);
  if (staticSet) return staticSet;

  const m = slug.match(/^kanji-(n[1-5])-set-(\d+)$/);
  if (m) {
    const [, level, nStr] = m;
    const n = parseInt(nStr, 10);
    const sets = chunkToSets(await kanjiCharsForLevel(level), level);
    return sets.find((s) => s.slug === `kanji-${level}-set-${n}`) ?? null;
  }
  return null;
}
