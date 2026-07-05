"use client";

import { useState } from "react";
import Link from "next/link";
import { WritingPracticeModal } from "@/components/learn/WritingPracticeModal";

export interface KanjiDbItem {
  id: string;
  character: string;
  meaning: string;
  stroke_count: number | null;
  onyomi: string[] | null;
  kunyomi: string[] | null;
  level: string;
  slug?: string;
}

interface KanjiClientProps {
  initialKanji: KanjiDbItem[];
}

export function KanjiClient({ initialKanji }: KanjiClientProps) {
  const [activeLevel, setActiveLevel] = useState<string>("N5");

  // Writing Modal State
  const [writingChar, setWritingChar] = useState("");
  const [writingStrokes, setWritingStrokes] = useState<number | null>(null);
  const [writingReading, setWritingReading] = useState("");
  const [writingMeaning, setWritingMeaning] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenWriting = (item: KanjiDbItem) => {
    setWritingChar(item.character);
    setWritingStrokes(item.stroke_count);
    const reading = [...(item.onyomi || []), ...(item.kunyomi || [])].slice(0, 3).join(", ");
    setWritingReading(reading);
    setWritingMeaning(item.meaning);
    setIsModalOpen(true);
  };

  const playTTS = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    window.speechSynthesis.speak(u);
  };

  // Filter Kanji by selected JLPT level
  const filteredKanji = initialKanji.filter(
    (k) => (k.level || "").toUpperCase() === activeLevel.toUpperCase()
  );

  const levels = ["N5", "N4", "N3", "N2", "N1"];

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-[#FAF8F5] min-h-[90vh]">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Breadcrumb */}
        <nav className="text-sm text-secondary mb-4 flex items-center gap-2">
          <Link href="/learn" className="hover:text-primary transition">Learn</Link>
          <span>/</span>
          <Link href="/learn/kana" className="hover:text-primary transition">Kana Portal</Link>
          <span>/</span>
          <span className="text-charcoal font-medium">Kanji Practice</span>
        </nav>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-charcoal mb-3">
            JLPT Kanji Stroke Practice
          </h1>
          <p className="text-secondary max-w-xl mx-auto">
            Study Onyomi, Kunyomi, meanings, and practice tracing Kanji character by character organized by JLPT level.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center gap-3 mb-8">
          {levels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setActiveLevel(lvl)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold border transition duration-200 ${
                activeLevel === lvl
                  ? "bg-primary border-primary text-white shadow-sm"
                  : "bg-white border-[var(--divider)] text-[#555] hover:border-primary hover:text-primary"
              }`}
            >
              {lvl} Level
            </button>
          ))}
        </div>

        {/* Kanji Grid */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[var(--divider)] shadow-sm">
          {filteredKanji.length === 0 ? (
            <div className="text-center py-12 text-secondary">
              No Kanji characters found for level {activeLevel} in the database.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredKanji.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--divider)] bg-[#FAF8F5] hover:border-primary hover:shadow-md transition duration-200"
                >
                  <div className="text-center mb-4">
                    {/* Big Kanji click triggers TTS */}
                    <span
                      onClick={() => playTTS(item.character)}
                      className="text-6xl font-bold text-charcoal block cursor-pointer hover:scale-105 transition-transform duration-200 select-none mb-2"
                      title="Click to hear pronunciation"
                    >
                      {item.character}
                    </span>
                    <h3 className="font-heading text-lg font-bold text-charcoal truncate">
                      {item.meaning}
                    </h3>
                    {item.stroke_count != null && (
                      <span className="text-xs text-secondary">{item.stroke_count} strokes</span>
                    )}
                  </div>

                  {/* Readings */}
                  <div className="space-y-1.5 text-xs border-t border-[var(--divider)]/40 pt-3 mb-4">
                    {Array.isArray(item.onyomi) && item.onyomi.length > 0 && (
                      <div className="flex gap-1">
                        <span className="text-secondary font-medium shrink-0">On:</span>
                        <span className="text-charcoal font-semibold truncate">{item.onyomi.join(", ")}</span>
                      </div>
                    )}
                    {Array.isArray(item.kunyomi) && item.kunyomi.length > 0 && (
                      <div className="flex gap-1">
                        <span className="text-secondary font-medium shrink-0">Kun:</span>
                        <span className="text-charcoal font-semibold truncate">{item.kunyomi.join(", ")}</span>
                      </div>
                    )}
                  </div>

                  {/* Practice Canvas Trigger */}
                  <button
                    type="button"
                    onClick={() => handleOpenWriting(item)}
                    className="w-full py-2 bg-primary hover:bg-primary/95 text-white text-sm font-semibold rounded-xl transition duration-150 flex items-center justify-center gap-2"
                  >
                    <span>Practice Drawing</span>
                    <span>✍️</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WritingPracticeModal
        character={writingChar}
        characterType="kanji"
        expectedStrokeCount={writingStrokes}
        reading={writingReading}
        meaning={writingMeaning}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
