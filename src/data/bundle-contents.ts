export interface BundleItem {
  name: string;
  children?: BundleItem[];
}

const MEGA_BUNDLE: BundleItem[] = [
  { name: "🏆 N1-Elite-Bundle" },
  { name: "🟥 N2-Pro-Bundle" },
  { name: "🟧 N3-Power-Bundle" },
  { name: "🟨 N4-Upgrade-Bundle" },
  { name: "🟩 N5-Mastery-Bundle" },
  { name: "🎌 Free-N5-Starter-Kit" },
  { name: "🎧 Audio-Booster-Pack" },
  { name: "📙 Reading-Compendium" },
  { name: "BONUS" },
  { name: "🧭 12-Month-Study-Roadmap.pdf" },
  { name: "🎴 Flashcards-AllLevels.pdf" },
  { name: "📝 JLPT-Master-Planner.pdf" },
];

const N5_BUNDLE: BundleItem[] = [
  { name: "📘 Kanji Mastery Guide" },
  { name: "📕 Vocabulary Workbook (Goi)" },
  { name: "📗 Grammar Workbook (Bunpo)" },
  { name: "📙 Reading Practice (Dokkai)" },
  { name: "🎧 Listening Audio (Chokai)" },
  { name: "🧩 JLPT N5 Mock Tests (×5)" },
  { name: "📝 Flashcards + Study Tracker" },
];

const N4_BUNDLE: BundleItem[] = [
  { name: "📘 N4 Kanji Workbook" },
  { name: "📕 Vocabulary Workbook (Goi)" },
  { name: "📗 Grammar Workbook (Bunpo)" },
  { name: "📙 Reading Practice (Dokkai)" },
  { name: "🎧 Listening Practice (Chokai)" },
  { name: "🧩 JLPT N4 Mock Tests (×5)" },
  { name: "📝 Flashcards + Study Timetable" },
];

const N3_BUNDLE: BundleItem[] = [
  { name: "📘 N3 Kanji Mastery Guide" },
  { name: "📕 Vocabulary Workbook (Goi)" },
  { name: "📗 Grammar Workbook (Bunpo)" },
  { name: "📙 Reading Practice (Dokkai)" },
  { name: "🎧 Listening Practice (Chokai)" },
  { name: "🧩 JLPT N3 Mock Tests (×5)" },
  { name: "📝 Flashcards + Study Tracker" },
];

const N2_BUNDLE: BundleItem[] = [
  { name: "📘 N2 Kanji Compendium" },
  { name: "📕 Vocabulary Workbook (Goi)" },
  { name: "📗 Grammar Guide (Bunpo)" },
  { name: "📙 Reading Practice (Dokkai)" },
  { name: "🎧 Listening Practice (Chokai)" },
  { name: "🧩 JLPT N2 Mock Tests (×5)" },
  { name: "📝 Flashcards + Study Planner" },
];

const N1_BUNDLE: BundleItem[] = [
  { name: "📘 N1 Kanji Encyclopedia" },
  { name: "📕 Vocabulary Workbook (Goi)" },
  { name: "📗 Grammar Reference (Bunpo)" },
  { name: "📙 Reading Practice (Dokkai)" },
  { name: "🎧 Listening Practice (Chokai)" },
  { name: "🧩 JLPT N1 Mock Tests (×5)" },
  { name: "📝 Flashcards + Revision Planner" },
];

export const BUNDLE_CONTENTS: Record<string, BundleItem[]> = {
  "complete-japanese-n5-n1-mega-bundle": MEGA_BUNDLE,
  "japanese-n5-mastery-bundle": N5_BUNDLE,
  "japanese-n4-upgrade-bundle": N4_BUNDLE,
  "japanese-n3-power-bundle": N3_BUNDLE,
  "japanese-n2-pro-bundle": N2_BUNDLE,
  "japanese-n1-elite-bundle": N1_BUNDLE,
};

export function getBundleContents(slug: string): BundleItem[] | undefined {
  return BUNDLE_CONTENTS[slug];
}
