import { sql } from "@/lib/db";
import { KanjiClient, type KanjiDbItem } from "./KanjiClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "JLPT Kanji Sheets & Drawing Practice | Japanese with Avnish",
  description: "Browse Kanji characters organized by JLPT level. View Onyomi, Kunyomi, stroke counts, and trace character shapes on the canvas.",
};

export default async function KanjiPracticePage() {
  let initialKanji: KanjiDbItem[] = [];

  if (sql) {
    try {
      const rows = (await sql`
        SELECT k.id, k.character, k.meaning, k.stroke_count, k.onyomi, k.kunyomi, (p.jlpt_level)[1] as level
        FROM kanji k
        JOIN posts p ON k.post_id = p.id
        ORDER BY k.character ASC
      `) as KanjiDbItem[];

      // Deduplicate Kanji by character
      const uniqueKanji: Record<string, KanjiDbItem> = {};
      for (const row of rows) {
        if (row && row.character && !uniqueKanji[row.character]) {
          uniqueKanji[row.character] = row;
        }
      }
      initialKanji = Object.values(uniqueKanji);
    } catch (e) {
      console.error("[KanjiPracticePage] Error fetching kanji:", e);
    }
  }

  return <KanjiClient initialKanji={initialKanji} />;
}
