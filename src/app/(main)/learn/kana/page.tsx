import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kana & Kanji Practice Portal | Japanese with Avnish",
  description: "Learn and practice writing Hiragana, Katakana, and Kanji characters with stroke-by-stroke guides, Japanese pronunciation audio, and interactive drawing canvases.",
};

export default function KanaPortalPage() {
  const cards = [
    {
      title: "Hiragana Practice",
      japanese: "平仮名",
      romaji: "Hiragana Chart & Stroke Order",
      desc: "Master the 46 primary Japanese phonetic characters. Interactive tracing, Japanese pronunciation audio, and guided writing feedback.",
      href: "/learn/kana/hiragana",
      characterBg: "あ",
    },
    {
      title: "Katakana Practice",
      japanese: "片仮名",
      romaji: "Katakana Chart & Stroke Order",
      desc: "Learn the character set used for foreign loanwords. Interactive tracing, Japanese pronunciation audio, and guided writing feedback.",
      href: "/learn/kana/katakana",
      characterBg: "ア",
    },
    {
      title: "Kanji Practice",
      japanese: "漢字",
      romaji: "JLPT Kanji Level Sheets",
      desc: "Interactive stroke sheets organized by JLPT level (N5 to N1). Study Onyomi/Kunyomi, meanings, and practice tracing.",
      href: "/learn/kana/kanji",
      characterBg: "漢",
    },
  ];

  return (
    <div className="py-12 sm:py-16 px-6 sm:px-8 lg:px-12 bg-[#FAF8F5] min-h-[85vh]">
      <div className="max-w-5xl mx-auto text-center">
        {/* Title */}
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
          Kana & Kanji Practice Portal
        </h1>
        <p className="text-secondary text-sm max-w-2xl mx-auto mb-12">
          Select a character set below to study stroke orders, listen to Japanese pronunciation audio, and practice writing on our interactive canvas with guided feedback.
        </p>

        {/* Grid */}
        <div className="grid md:grid-cols-3 gap-8 text-left">
          {cards.map((card) => (
            <div
              key={card.title}
              className="relative group p-6 rounded-2xl overflow-hidden border border-[#E2E8F0] bg-white flex flex-col justify-between hover:border-primary hover:shadow-md transition-all duration-300"
            >
              {/* Massive background character watermark — this page's stand-in for Learn Hub's
                  per-card photo, since there's no per-character-set image. */}
              <span className="absolute -right-6 -bottom-10 text-[9rem] font-bold text-charcoal/[0.03] select-none group-hover:scale-110 transition-transform duration-300">
                {card.characterBg}
              </span>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold tracking-wider uppercase text-secondary">
                    {card.romaji}
                  </span>
                  <span className="text-2xl font-bold text-charcoal">{card.japanese}</span>
                </div>
                <h2 className="text-2xl font-heading font-bold text-charcoal mb-3">
                  {card.title}
                </h2>
                <p className="text-secondary text-sm leading-relaxed mb-6">
                  {card.desc}
                </p>
              </div>

              <Link href={card.href} className="btn-primary w-full justify-center relative z-10">
                Start Practice &rarr;
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
