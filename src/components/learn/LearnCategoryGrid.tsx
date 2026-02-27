import Link from "next/link";
import type { LearnLevel } from "@/lib/learn-filters";

const CATEGORIES = [
  { type: "grammar", label: "Grammar", desc: "文法 — Grammar patterns and structures", kanji: "文法" },
  { type: "vocabulary", label: "Vocabulary", desc: "語彙 — Words and expressions", kanji: "語彙" },
  { type: "kanji", label: "Kanji", desc: "漢字 — Characters and readings", kanji: "漢字" },
  { type: "reading", label: "Reading", desc: "読解 — Reading comprehension", kanji: "読解" },
  { type: "writing", label: "Writing", desc: "作文 — Writing practice", kanji: "作文" },
];

interface LearnCategoryGridProps {
  level: LearnLevel;
}

export function LearnCategoryGrid({ level }: LearnCategoryGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CATEGORIES.map((item) => {
        const href =
          level === "all"
            ? `/learn/${item.type}`
            : `/learn/${item.type}?level=${level}`;
        return (
          <Link
            key={item.type}
            href={href}
            className="card block p-6 hover:no-underline group transition"
          >
            <span className="text-primary text-2xl block mb-2">{item.kanji}</span>
            <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">
              {item.label}
            </h2>
            <p className="text-secondary text-sm mt-1">{item.desc}</p>
          </Link>
        );
      })}
    </div>
  );
}
