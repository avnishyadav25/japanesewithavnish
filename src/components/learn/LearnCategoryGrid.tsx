import Link from "next/link";
import type { LearnLevel } from "@/lib/learn-filters";

const CATEGORIES = [
  { type: "grammar", label: "Grammar", desc: "文法 — Grammar patterns and structures", kanji: "文法" },
  { type: "vocabulary", label: "Vocabulary", desc: "語彙 — Words and expressions", kanji: "語彙" },
  { type: "kanji", label: "Kanji", desc: "漢字 — Characters and readings", kanji: "漢字" },
  { type: "reading", label: "Reading", desc: "読解 — Reading comprehension", kanji: "読解" },
  { type: "writing", label: "Writing", desc: "作文 — Writing practice", kanji: "作文" },
  { type: "listening", label: "Listening", desc: "聴解 — Listening practice", kanji: "聴解" },
  { type: "sounds", label: "Sounds", desc: "発音 — Kana and pronunciation", kanji: "発音" },
  { type: "study_guide", label: "Study guide", desc: "学習ガイド — How to pass JLPT", kanji: "学習" },
  { type: "practice_test", label: "Practice test", desc: "模擬試験 — Mock tests", kanji: "模試" },
];

interface LearnCategoryGridProps {
  level: LearnLevel;
  activeCategory?: string;
}

export function LearnCategoryGrid({ level, activeCategory }: LearnCategoryGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((item) => {
        const href =
          level === "all"
            ? `/learn/${item.type}`
            : `/learn/${item.type}?level=${level}`;
        const isActive = activeCategory === item.type;
        return (
          <Link
            key={item.type}
            href={href}
            className={`px-4 py-2 rounded-full text-sm font-medium transition no-underline ${
              isActive
                ? "bg-primary text-white"
                : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary hover:text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
