import Link from "next/link";

const LEARN_TYPES = [
  { type: "grammar", label: "Grammar", desc: "文法 — Grammar patterns and structures", kanji: "文法" },
  { type: "vocabulary", label: "Vocabulary", desc: "語彙 — Words and expressions", kanji: "語彙" },
  { type: "kanji", label: "Kanji", desc: "漢字 — Characters and readings", kanji: "漢字" },
  { type: "reading", label: "Reading", desc: "読解 — Reading comprehension", kanji: "読解" },
  { type: "writing", label: "Writing", desc: "作文 — Writing practice", kanji: "作文" },
];

export default function LearnHubPage() {
  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 japanese-wave-bg">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="japanese-kanji-accent text-xl">学習</span>
            <span className="text-secondary">—</span>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal">Learn</h1>
          </div>
          <p className="text-secondary">
            Grammar, vocabulary, kanji, reading, and writing — structured by JLPT level.
          </p>
        </div>

        <div className="bento-grid">
          {LEARN_TYPES.map((item) => (
            <Link
              key={item.type}
              href={`/learn/${item.type}`}
              className="bento-span-2 card block hover:no-underline group"
            >
              <span className="japanese-kanji-accent text-2xl block mb-2">{item.kanji}</span>
              <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">
                {item.label}
              </h2>
              <p className="text-secondary text-sm mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
