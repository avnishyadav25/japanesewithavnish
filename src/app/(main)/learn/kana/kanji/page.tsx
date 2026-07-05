import { sql } from "@/lib/db";
import { KanjiClient, type KanjiDbItem } from "./KanjiClient";
import { Metadata } from "next";
import fs from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "JLPT Kanji Sheets & Drawing Practice | Japanese with Avnish",
  description: "Browse Kanji characters organized by JLPT level. View Onyomi, Kunyomi, stroke counts, and trace character shapes on the canvas.",
};

export default async function KanjiPracticePage() {
  let dbKanji: KanjiDbItem[] = [];

  // 1. Fetch from database
  if (sql) {
    try {
      const rows = (await sql`
        SELECT k.id, k.character, k.meaning, k.stroke_count, k.onyomi, k.kunyomi, (p.jlpt_level)[1] as level
        FROM kanji k
        JOIN posts p ON k.post_id = p.id
        ORDER BY k.character ASC
      `) as KanjiDbItem[];
      dbKanji = rows || [];
    } catch (e) {
      console.error("[KanjiPracticePage] Error fetching db kanji:", e);
    }
  }

  // 2. Read fallback JSON
  const jsonKanji: KanjiDbItem[] = [];
  try {
    const filePath = path.join(process.cwd(), "src/data/kanji_jlpt_only.json");
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      
      // Convert JSON structure to KanjiDbItem[]
      for (const char in fileData) {
        const item = fileData[char];
        // Convert "jlpt" numbers (1, 2, 3, 4, 5) to "N1", "N2", "N3", "N4", "N5"
        const jlptNum = item.jlpt;
        const levelStr = jlptNum ? `N${jlptNum}` : "N5";
        
        jsonKanji.push({
          id: `json-${char}-${levelStr}`,
          character: char,
          meaning: (item.meanings || []).join(", ") || "",
          stroke_count: item.stroke_count || null,
          onyomi: item.on_readings || null,
          kunyomi: item.kun_readings || null,
          level: levelStr,
        });
      }
    }
  } catch (e) {
    console.error("[KanjiPracticePage] Error parsing json kanji:", e);
  }

  // 3. Merge: Database takes priority, then fallback to JSON
  const mergedKanjiMap: Record<string, KanjiDbItem> = {};
  
  // Add fallback first
  for (const item of jsonKanji) {
    mergedKanjiMap[item.character] = item;
  }
  
  // Overwrite with DB kanji (so database customized meanings/slugs take precedence!)
  for (const item of dbKanji) {
    if (item && item.character) {
      mergedKanjiMap[item.character] = {
        ...mergedKanjiMap[item.character],
        ...item,
      };
    }
  }

  const initialKanji = Object.values(mergedKanjiMap);

  return <KanjiClient initialKanji={initialKanji} />;
}
